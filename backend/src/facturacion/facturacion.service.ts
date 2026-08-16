import { BadRequestException, Injectable } from '@nestjs/common';
import { MetodoPago, TipoFactura, TipoNcf } from '@prisma/client';
import { FacturacionRepository } from './facturacion.repository';
import { InventarioService } from '../inventario/inventario.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { CrearPagoDto } from '../pagos/dto/crear-pago.dto';
import { PagosService } from '../pagos/pagos.service';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { generarDocumentoPdf } from '../common/pdf/documento-pdf';

const NOMBRE_TIPO_FACTURA: Record<TipoFactura, string> = {
  CONTADO: 'Factura de venta',
  CREDITO: 'Factura de venta',
  NOTA_CREDITO: 'Nota de crédito',
  NOTA_DEBITO: 'Nota de débito',
};

const NCF_POR_TIPO: Record<TipoFactura, TipoNcf> = {
  CREDITO: 'B01',
  CONTADO: 'B02',
  NOTA_DEBITO: 'B03',
  NOTA_CREDITO: 'B04',
};

// e-CF (comprobantes electrónicos DGII): mismo TipoFactura, prefijo distinto.
// Reutiliza el mismo NcfAsignado/siguienteNcfEnTx — ver ARCHITECTURE.md,
// "e-NCF propio": esta fase solo cubre la numeración, no la firma/envío.
const ECF_POR_TIPO: Record<TipoFactura, TipoNcf> = {
  CREDITO: 'E31',
  CONTADO: 'E32',
  NOTA_DEBITO: 'E33',
  NOTA_CREDITO: 'E34',
};

@Injectable()
export class FacturacionService {
  constructor(
    private readonly facturacionRepository: FacturacionRepository,
    private readonly inventarioService: InventarioService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly eventBus: EventBusService,
    private readonly pagosService: PagosService,
  ) {}

  /**
   * El descuento/reintegro de stock, el consumo de NCF y la creación de la
   * factura corrían como pasos sueltos, cada uno con su propia transacción
   * (o ninguna) — un fallo a mitad de camino (p. ej. la línea 2 de 3 sin
   * stock suficiente, o la secuencia de NCF agotada) dejaba las líneas
   * anteriores YA aplicadas: stock descontado sin ninguna factura que lo
   * justifique. Envolver las tres cosas en una sola transacción
   * (`tenantPrisma.client.$transaction`) las hace todo-o-nada.
   */
  async crear(dto: CrearFacturaDto, tenantId: string, vendedorId: string, opciones?: { metodoPago?: MetodoPago; turnoCajaId?: string }) {
    const lineasCalculadas = await Promise.all(
      dto.lineas.map(async (linea) => {
        const producto = await this.facturacionRepository.obtenerProductoConPrecioVigente(linea.productoId);
        const precioUnitario = linea.precioUnitario ?? Number(producto.precios[0]?.precioVenta ?? 0);
        const porcentajeItbis = Number(producto.porcentajeItbis);
        const descuento = linea.descuento ?? 0;

        const totalLinea = linea.cantidad * precioUnitario - descuento;
        const montoItbis = totalLinea * (porcentajeItbis / 100);

        return {
          productoId: linea.productoId,
          cantidad: linea.cantidad,
          precioUnitario,
          descuento,
          porcentajeItbis,
          montoItbis,
          montoTotal: totalLinea + montoItbis,
        };
      }),
    );

    const subtotalLineas = lineasCalculadas.reduce((acc, l) => acc + (l.cantidad * l.precioUnitario - l.descuento), 0);
    const itbisLineas = lineasCalculadas.reduce((acc, l) => acc + l.montoItbis, 0);
    const descuentoTotal = lineasCalculadas.reduce((acc, l) => acc + l.descuento, 0);
    // Se almacenan en negativo para que sumar directamente todas las
    // facturas de un rango (reportes, dashboard) dé el neto correcto sin
    // tener que conocer el tipoFactura en cada consulta.
    const signo = dto.tipoFactura === 'NOTA_CREDITO' ? -1 : 1;
    const subtotal = subtotalLineas * signo;
    const itbis = itbisLineas * signo;
    const total = (subtotalLineas + itbisLineas) * signo;
    const modalidad = await this.facturacionRepository.obtenerModalidadFacturacion(tenantId);
    const tipoNcf = (modalidad === 'ECF' ? ECF_POR_TIPO : NCF_POR_TIPO)[dto.tipoFactura];

    const factura = await this.tenantPrisma.client.$transaction(async (tx) => {
      // Una nota de crédito devuelve al cliente lo comprado: el inventario
      // debe aumentar, no descontarse otra vez. Una nota de débito es un
      // ajuste monetario (recargo, interés) sin contrapartida física, así
      // que no toca inventario. Solo una venta normal (CONTADO/CREDITO)
      // descuenta.
      if (dto.tipoFactura === 'NOTA_CREDITO') {
        for (const linea of dto.lineas) {
          await this.inventarioService.entradaStockEnTx(tx, {
            tenantId,
            productoId: linea.productoId,
            bodegaId: dto.bodegaId,
            cantidad: linea.cantidad,
            userId: vendedorId,
            motivo: 'Devolución por nota de crédito',
          });
        }
      } else if (dto.tipoFactura !== 'NOTA_DEBITO') {
        for (const linea of dto.lineas) {
          await this.inventarioService.verificarYDescontarStockEnTx(tx, {
            tenantId,
            productoId: linea.productoId,
            bodegaId: dto.bodegaId,
            cantidad: linea.cantidad,
            userId: vendedorId,
            referencia: 'Venta por factura',
          });
        }
      }

      const ncf = await this.facturacionRepository.siguienteNcfEnTx(tx, tipoNcf);

      return this.facturacionRepository.crearFacturaEnTx(tx, {
        tenantId,
        clienteId: dto.clienteId,
        vendedorId,
        bodegaId: dto.bodegaId,
        tipoFactura: dto.tipoFactura,
        ncf,
        tipoNcf,
        facturaOrigenId: dto.facturaOrigenId,
        metodoPago: opciones?.metodoPago,
        turnoCajaId: opciones?.turnoCajaId,
        subtotal,
        descuento: descuentoTotal,
        itbis,
        total,
        lineas: lineasCalculadas,
      });
    });

    this.eventBus.emit(EVENTOS.FACTURA_CREADA, {
      tenantId,
      facturaId: factura.id,
      clienteId: factura.clienteId,
      total: factura.total.toString(),
      subtotal: factura.subtotal.toString(),
      itbis: factura.itbis.toString(),
      tipoFactura: factura.tipoFactura,
    });

    return factura;
  }

  buscarPorId(id: string) {
    return this.facturacionRepository.buscarPorId(id);
  }

  async generarPdf(id: string) {
    const factura = await this.facturacionRepository.buscarPorId(id);
    return generarDocumentoPdf({
      tipoDocumento: NOMBRE_TIPO_FACTURA[factura.tipoFactura],
      numero: factura.ncf ?? factura.id,
      fecha: factura.fecha,
      cliente: factura.cliente.nombre,
      lineas: factura.lineas.map((linea) => ({
        concepto: linea.producto.nombre,
        cantidad: linea.cantidad.toString(),
        precioUnitario: Number(linea.precioUnitario).toFixed(2),
        total: Number(linea.montoTotal).toFixed(2),
      })),
      subtotal: Number(factura.subtotal),
      descuento: Number(factura.descuento),
      itbis: Number(factura.itbis),
      total: Number(factura.total),
    });
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.facturacionRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  /** Misma razón que en `crear()`: la reintegración/re-descuento de stock y el cambio de estado de la factura corren en una sola transacción. */
  async anular(id: string, motivo: string, tenantId: string, userId: string) {
    const factura = await this.facturacionRepository.buscarPorId(id);
    if (factura.estado === 'ANULADA') {
      throw new BadRequestException('La factura ya está anulada');
    }

    const facturaAnulada = await this.tenantPrisma.client.$transaction(async (tx) => {
      if (factura.bodegaId) {
        if (factura.tipoFactura === 'NOTA_CREDITO') {
          // La nota había devuelto stock al crearse; anularla lo retira de nuevo.
          for (const linea of factura.lineas) {
            await this.inventarioService.verificarYDescontarStockEnTx(tx, {
              tenantId,
              productoId: linea.productoId,
              bodegaId: factura.bodegaId,
              cantidad: Number(linea.cantidad),
              userId,
              referencia: `Anulación de nota de crédito ${factura.ncf ?? factura.id}`,
            });
          }
        } else if (factura.tipoFactura !== 'NOTA_DEBITO') {
          // Si ya se emitieron notas de crédito (parciales) contra esta
          // factura, esa cantidad ya se devolvió al inventario — reintegrar
          // el total otra vez la duplicaría.
          const yaDevueltoPorProducto = new Map<string, number>();
          for (const nota of factura.notasRelacionadas ?? []) {
            for (const lineaNota of nota.lineas) {
              yaDevueltoPorProducto.set(
                lineaNota.productoId,
                (yaDevueltoPorProducto.get(lineaNota.productoId) ?? 0) + Number(lineaNota.cantidad),
              );
            }
          }

          for (const linea of factura.lineas) {
            const yaDevuelto = yaDevueltoPorProducto.get(linea.productoId) ?? 0;
            const cantidadAReintegrar = Number(linea.cantidad) - yaDevuelto;
            if (cantidadAReintegrar > 0) {
              await this.inventarioService.entradaStockEnTx(tx, {
                tenantId,
                productoId: linea.productoId,
                bodegaId: factura.bodegaId,
                cantidad: cantidadAReintegrar,
                userId,
                motivo: `Anulación de factura ${factura.ncf ?? factura.id}`,
              });
            }
          }
        }
      }

      return this.facturacionRepository.anularEnTx(tx, id, motivo);
    });

    this.eventBus.emit(EVENTOS.FACTURA_ANULADA, {
      tenantId,
      facturaId: id,
      clienteId: facturaAnulada.clienteId,
      total: facturaAnulada.total.toString(),
      subtotal: facturaAnulada.subtotal.toString(),
      itbis: facturaAnulada.itbis.toString(),
      tipoFactura: facturaAnulada.tipoFactura,
    });
    return facturaAnulada;
  }

  async registrarPago(id: string, dto: CrearPagoDto, userId: string, tenantId: string) {
    const factura = await this.facturacionRepository.buscarPorId(id);
    if (factura.estado !== 'EMITIDA') {
      throw new BadRequestException('Solo se puede registrar el pago de una factura EMITIDA');
    }
    if (factura.tipoFactura === 'NOTA_CREDITO' || factura.tipoFactura === 'NOTA_DEBITO') {
      throw new BadRequestException('Las notas de crédito/débito no reciben pagos');
    }
    if (factura.pagada) {
      throw new BadRequestException('Esta factura ya está pagada en su totalidad');
    }
    return this.pagosService.registrarPagoFactura(factura, dto, userId, tenantId);
  }

  listarPagos(facturaId: string) {
    return this.pagosService.listarPorFactura(facturaId);
  }
}
