import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { FormatoImpresion, Prisma, TipoFactura, TipoNcf, TipoProducto } from '@prisma/client';
import { FacturacionRepository } from './facturacion.repository';
import { InventarioService } from '../inventario/inventario.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { CrearPagoDto } from '../pagos/dto/crear-pago.dto';
import { PagosService } from '../pagos/pagos.service';
import { ClientesService } from '../clientes/clientes.service';
import { VariantesService } from '../variantes/variantes.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { prorratearDescuentoCarrito } from '../ofertas/prorratear-descuento-carrito';
import { ListarFacturasQueryDto } from './dto/listar-facturas-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { DocumentoPdfParams, generarDocumentoPdf } from '../common/pdf/documento-pdf';
import { generarDocumentoTicketHtml } from '../common/pdf/documento-ticket';
import { resolverFormatoImpresion } from '../common/impresion/resolver-formato-impresion';
import { PrismaService } from '../prisma/prisma.service';

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

/**
 * Un SERVICIO nunca mueve inventario. Un COMBO expande a sus componentes
 * físicos (cantidad de la línea × cantidad del componente) — el combo en sí
 * nunca tiene fila propia en Stock. Un componente está restringido en
 * ProductosService a PRODUCTO/SERVICIO (nunca otro COMBO), así que un solo
 * nivel de expansión alcanza, sin necesidad de recursión.
 */
/**
 * `varianteId` (Fase 3c) es la variante YA resuelta de `productoId` — solo
 * tiene sentido para el producto vendido directamente, no para los
 * componentes de un combo (nadie elige variante por componente; cada uno
 * resuelve la suya propia — su "por defecto" si tiene una sola, o rechaza
 * si tiene varias — en `InventarioService`, ver `VariantesService.
 * resolverObligatoria`).
 */
function expandirParaInventario(
  producto: {
    tipoProducto: TipoProducto;
    componentesCombo: Array<{ cantidad: Prisma.Decimal; componente: { id: string; tipo: TipoProducto } }>;
  },
  productoId: string,
  cantidad: number,
  varianteId?: string,
): Array<{ productoId: string; cantidad: number; varianteId?: string }> {
  if (producto.tipoProducto === 'SERVICIO') return [];
  if (producto.tipoProducto === 'COMBO') {
    return producto.componentesCombo
      .filter((c) => c.componente.tipo !== 'SERVICIO')
      .map((c) => ({ productoId: c.componente.id, cantidad: cantidad * Number(c.cantidad) }));
  }
  return [{ productoId, cantidad, varianteId }];
}

@Injectable()
export class FacturacionService {
  constructor(
    private readonly facturacionRepository: FacturacionRepository,
    private readonly inventarioService: InventarioService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly eventBus: EventBusService,
    private readonly pagosService: PagosService,
    private readonly prisma: PrismaService,
    private readonly clientesService: ClientesService,
    private readonly variantesService: VariantesService,
    private readonly ofertasService: OfertasService,
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
  async crear(
    dto: CrearFacturaDto,
    tenantId: string,
    vendedorId: string,
    opciones?: {
      formaPagoId?: string;
      referenciaPago?: string;
      turnoCajaId?: string;
      vendedorEmpleadoId?: string;
      pagos?: { formaPagoId: string; monto: number; referencia?: string }[];
    },
  ) {
    // findUniqueOrThrow tenant-scoped: si clienteId es de otro tenant, 404 —
    // mismo patrón de prevención de IDOR ya documentado para FKs
    // cliente-suministradas. De paso resuelve el nivel de precio del
    // cliente para las líneas que no traen precioUnitario explícito.
    const cliente = await this.clientesService.buscarPorId(dto.clienteId);
    const listaPrecio = dto.listaPrecio ?? cliente.listaPrecio?.nombre ?? 'GENERAL';
    // Ofertas (Fase 4b) solo aplican a una venta nueva — una nota de
    // crédito/débito ajusta un monto YA facturado, nunca recalcula un
    // descuento fresco sobre lo que se está devolviendo/cargando.
    const esVentaNormal = dto.tipoFactura === 'CONTADO' || dto.tipoFactura === 'CREDITO';

    const lineasCalculadas = await Promise.all(
      dto.lineas.map(async (linea) => {
        // La variante se resuelve UNA vez por línea y se reusa tanto para el
        // precio (abajo) como para el descuento/reintegro de stock (en la
        // transacción) — así ambos operan sobre la misma variante, nunca
        // una resolución distinta de la otra.
        const varianteId = await this.variantesService.resolverObligatoria(linea.productoId, linea.varianteId);
        const producto = await this.facturacionRepository.obtenerProductoConPrecioVigente(linea.productoId, varianteId, listaPrecio);
        const precioUnitario = linea.precioUnitario ?? Number(producto.precios[0]?.precioVenta ?? 0);
        const porcentajeItbis = Number(producto.porcentajeItbis);
        // Un descuento manual explícito (aunque sea 0) siempre gana sobre
        // el automático — ver OfertasService, "no acumulable".
        const descuento =
          linea.descuento ??
          (esVentaNormal ? await this.ofertasService.resolverDescuentoLinea(linea.productoId, producto.categoriaId, linea.cantidad, precioUnitario) : 0);

        const totalLinea = linea.cantidad * precioUnitario - descuento;
        const montoItbis = totalLinea * (porcentajeItbis / 100);

        return {
          productoId: linea.productoId,
          varianteId,
          cantidad: linea.cantidad,
          precioUnitario,
          descuento,
          porcentajeItbis,
          montoItbis,
          montoTotal: totalLinea + montoItbis,
          // Solo para decidir el efecto en inventario más abajo — no se
          // persisten en LineaFactura (crearFacturaEnTx solo toma los
          // campos que sí son columnas propias).
          tipoProducto: producto.tipo,
          componentesCombo: producto.componentes,
        };
      }),
    );

    if (esVentaNormal) {
      const subtotalPreCarrito = lineasCalculadas.reduce((acc, l) => acc + (l.cantidad * l.precioUnitario - l.descuento), 0);
      const descuentoCarritoTotal = await this.ofertasService.resolverDescuentoCarritoTotal(subtotalPreCarrito);
      if (descuentoCarritoTotal > 0) {
        const extras = prorratearDescuentoCarrito(
          subtotalPreCarrito,
          lineasCalculadas.map((l) => l.cantidad * l.precioUnitario - l.descuento),
          descuentoCarritoTotal,
        );
        lineasCalculadas.forEach((l, i) => {
          l.descuento += extras[i];
          const totalLinea = l.cantidad * l.precioUnitario - l.descuento;
          l.montoItbis = totalLinea * (l.porcentajeItbis / 100);
          l.montoTotal = totalLinea + l.montoItbis;
        });
      }
    }

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

    // Pago dividido (POS, ver PosService.registrarVenta): si vienen `pagos`
    // explícitos, deben sumar exacto el total (EPSILON, mismo criterio que
    // PagosService); si no, se sintetiza un único pago desde formaPagoId
    // (caso de un solo método — resto de POS, Devolución) para que todo
    // termine en el mismo ledger PagoVenta sin dos caminos de código.
    const EPSILON_PAGOS = 0.005;
    if (opciones?.pagos?.length) {
      const sumaPagos = opciones.pagos.reduce((acc, p) => acc + p.monto, 0);
      if (Math.abs(sumaPagos - total) > EPSILON_PAGOS) {
        throw new BadRequestException(
          `La suma de los pagos (RD$ ${sumaPagos.toFixed(2)}) no coincide con el total de la venta (RD$ ${total.toFixed(2)})`,
        );
      }
    }
    const pagosResueltos =
      opciones?.pagos ?? (opciones?.formaPagoId ? [{ formaPagoId: opciones.formaPagoId, monto: total, referencia: opciones.referenciaPago }] : []);
    const formaPagoPrincipal = pagosResueltos.length
      ? pagosResueltos.reduce((max, p) => (Math.abs(p.monto) > Math.abs(max.monto) ? p : max))
      : undefined;

    const modalidad = await this.facturacionRepository.obtenerModalidadFacturacion(tenantId);
    const tipoNcf = (modalidad === 'ECF' ? ECF_POR_TIPO : NCF_POR_TIPO)[dto.tipoFactura];

    const factura = await this.tenantPrisma.client.$transaction(async (tx) => {
      // Una nota de crédito devuelve al cliente lo comprado: el inventario
      // debe aumentar, no descontarse otra vez. Una nota de débito es un
      // ajuste monetario (recargo, interés) sin contrapartida física, así
      // que no toca inventario. Solo una venta normal (CONTADO/CREDITO)
      // descuenta.
      if (dto.tipoFactura === 'NOTA_CREDITO') {
        for (const linea of lineasCalculadas) {
          for (const item of expandirParaInventario(linea, linea.productoId, linea.cantidad, linea.varianteId)) {
            await this.inventarioService.entradaStockEnTx(tx, {
              tenantId,
              productoId: item.productoId,
              varianteId: item.varianteId,
              bodegaId: dto.bodegaId,
              cantidad: item.cantidad,
              userId: vendedorId,
              motivo: 'Devolución por nota de crédito',
            });
          }
        }
      } else if (dto.tipoFactura !== 'NOTA_DEBITO') {
        for (const linea of lineasCalculadas) {
          for (const item of expandirParaInventario(linea, linea.productoId, linea.cantidad, linea.varianteId)) {
            await this.inventarioService.verificarYDescontarStockEnTx(tx, {
              tenantId,
              productoId: item.productoId,
              varianteId: item.varianteId,
              bodegaId: dto.bodegaId,
              cantidad: item.cantidad,
              userId: vendedorId,
              referencia: 'Venta por factura',
            });
          }
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
        formaPagoId: formaPagoPrincipal?.formaPagoId,
        referenciaPago: formaPagoPrincipal?.referencia,
        turnoCajaId: opciones?.turnoCajaId,
        vendedorEmpleadoId: opciones?.vendedorEmpleadoId,
        pagos: pagosResueltos,
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

  private mapearFacturaAParams(factura: Awaited<ReturnType<FacturacionRepository['buscarPorId']>>): DocumentoPdfParams {
    return {
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
    };
  }

  /** @deprecated usar generarImpreso — se mantiene por compatibilidad de la ruta /pdf ya existente. */
  async generarPdf(id: string) {
    const factura = await this.facturacionRepository.buscarPorId(id);
    return generarDocumentoPdf(this.mapearFacturaAParams(factura));
  }

  async generarImpreso(id: string, formatoSolicitado: FormatoImpresion | undefined, tenantId: string) {
    const factura = await this.facturacionRepository.buscarPorId(id);
    const formato = formatoSolicitado ?? (await resolverFormatoImpresion(this.prisma, tenantId, factura.bodegaId));
    const params = this.mapearFacturaAParams(factura);

    if (formato === 'TERMICA_80MM' || formato === 'TERMICA_58MM') {
      return { buffer: Buffer.from(generarDocumentoTicketHtml(params, formato), 'utf-8'), contentType: 'text/html; charset=utf-8' };
    }
    const buffer = await generarDocumentoPdf(params, { tamanoPagina: formato === 'A4' ? 'a4' : 'letter' });
    return { buffer, contentType: 'application/pdf' };
  }

  async listar(query: ListarFacturasQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.facturacionRepository.listar({
      skip,
      take,
      busqueda: query.busqueda,
      tiposFactura: query.tipoFactura,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  /** Misma razón que en `crear()`: la reintegración/re-descuento de stock y el cambio de estado de la factura corren en una sola transacción. */
  async anular(id: string, motivo: string, tenantId: string, userId: string, puedeSupervisarCaja: boolean) {
    const factura = await this.facturacionRepository.buscarPorId(id);
    if (factura.estado === 'ANULADA') {
      throw new BadRequestException('La factura ya está anulada');
    }

    // Un Cajero (sin pos.supervisar) solo puede anular ventas de POS de SU
    // propio turno mientras sigue abierto — ver docs/ARCHITECTURE.md,
    // "Roles de POS: Cajero, Vendedor, Supervisor de Caja". Facturas que no
    // vienen de POS (turnoCaja null) no aplican esta restricción — hoy solo
    // Admin Total/Gerente/Supervisor de Caja llegan a anular esas, y todos
    // tienen pos.supervisar.
    if (!puedeSupervisarCaja && factura.turnoCaja) {
      if (factura.turnoCaja.cajeroId !== userId || factura.turnoCaja.estado !== 'ABIERTO') {
        throw new ForbiddenException('Solo podés anular ventas de tu propio turno mientras sigue abierto.');
      }
    }

    const facturaAnulada = await this.tenantPrisma.client.$transaction(async (tx) => {
      if (factura.bodegaId) {
        if (factura.tipoFactura === 'NOTA_CREDITO') {
          // La nota había devuelto stock al crearse; anularla lo retira de nuevo.
          for (const linea of factura.lineas) {
            const producto = { tipoProducto: linea.producto.tipo, componentesCombo: linea.producto.componentes };
            for (const item of expandirParaInventario(producto, linea.productoId, Number(linea.cantidad), linea.varianteId)) {
              await this.inventarioService.verificarYDescontarStockEnTx(tx, {
                tenantId,
                productoId: item.productoId,
                varianteId: item.varianteId,
                bodegaId: factura.bodegaId,
                cantidad: item.cantidad,
                userId,
                referencia: `Anulación de nota de crédito ${factura.ncf ?? factura.id}`,
              });
            }
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
              const producto = { tipoProducto: linea.producto.tipo, componentesCombo: linea.producto.componentes };
              for (const item of expandirParaInventario(producto, linea.productoId, cantidadAReintegrar, linea.varianteId)) {
                await this.inventarioService.entradaStockEnTx(tx, {
                  tenantId,
                  productoId: item.productoId,
                  varianteId: item.varianteId,
                  bodegaId: factura.bodegaId,
                  cantidad: item.cantidad,
                  userId,
                  motivo: `Anulación de factura ${factura.ncf ?? factura.id}`,
                });
              }
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
