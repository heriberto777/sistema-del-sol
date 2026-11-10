import { BadRequestException, Injectable } from '@nestjs/common';
import { FacturasProveedorRepository } from './facturas-proveedor.repository';
import { CuentasPorPagarRepository } from '../cuentas-por-pagar/cuentas-por-pagar.repository';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { TerminosPagoService } from '../terminos-pago/terminos-pago.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CierrePeriodoService } from '../contabilidad/cierre-periodo.service';
import { CrearFacturaProveedorDto } from './dto/crear-factura-proveedor.dto';
import type { CrearPagoOrdenCompraDto } from '../compras/dto/crear-pago-orden-compra.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { calcularFechaVencimiento } from '../common/fecha/dias-vencido.util';
import { PagosService } from '../pagos/pagos.service';
import { ExtractorFacturaService } from '../ia/extractor-factura/extractor-factura.service';
import { UsoIaService } from '../ia/uso-ia.service';

const EPSILON = 0.005; // tolerancia de redondeo en centavos, igual que PagosService/AsientosContablesService

@Injectable()
export class FacturasProveedorService {
  constructor(
    private readonly facturasProveedorRepository: FacturasProveedorRepository,
    private readonly cuentasPorPagarRepository: CuentasPorPagarRepository,
    private readonly proveedoresService: ProveedoresService,
    private readonly terminosPagoService: TerminosPagoService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly eventBus: EventBusService,
    private readonly cierrePeriodoService: CierrePeriodoService,
    private readonly pagosService: PagosService,
    private readonly extractorFacturaService: ExtractorFacturaService,
    private readonly usoIaService: UsoIaService,
  ) {}

  /**
   * Benchmark 2026-11-09 (Fase 10) — "crear desde imagen/PDF". Nunca crea
   * nada solo: devuelve los campos leídos para que `FacturaProveedorNueva`
   * los muestre en el formulario de siempre, editables, antes de guardar
   * — la clasificación contable por línea (`cuentaContableId`) no se puede
   * leer de la imagen (es un criterio interno del negocio), así que esto
   * nunca intenta armar las líneas solo.
   */
  async extraerDesdeArchivo(archivo: string, tenantId: string) {
    await this.usoIaService.verificarYRegistrar(tenantId, 'EXTRACCION_FACTURA');
    return this.extractorFacturaService.extraerDesdeDataUri(archivo);
  }

  /**
   * Fase 5 (CxP) — FacturaProveedor nace síncrona con su CuentaPorPagar,
   * igual que ComprasService.recibir() (nunca por evento, ver
   * docs/ARCHITECTURE.md). NOTA_CREDITO no tiene CuentaPorPagar propia: en
   * vez de eso reduce la de la FACTURA origen (ajuste financiero puro).
   */
  async crear(dto: CrearFacturaProveedorDto, tenantId: string, userId: string | null) {
    const tipo = dto.tipo ?? 'FACTURA';
    const lineasCalculadas = dto.lineas.map((linea) => {
      const cantidad = linea.cantidad ?? 1;
      const porcentajeItbis = linea.porcentajeItbis ?? 0;
      const montoItbis = linea.valor * cantidad * (porcentajeItbis / 100);
      return {
        cuentaContableId: linea.cuentaContableId,
        concepto: linea.concepto,
        valor: linea.valor,
        porcentajeItbis,
        montoItbis,
        cantidad,
        montoTotal: linea.valor * cantidad + montoItbis,
      };
    });

    const subtotal = lineasCalculadas.reduce((acc, l) => acc + l.valor * l.cantidad, 0);
    const itbis = lineasCalculadas.reduce((acc, l) => acc + l.montoItbis, 0);
    const total = subtotal + itbis;

    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    await this.cierrePeriodoService.validarFechaAbierta(fecha);

    // Tenant-scoped — 404 si el proveedor es de otro tenant.
    const proveedor = await this.proveedoresService.buscarPorId(dto.proveedorId);
    const terminoPago = dto.terminoPagoId ? await this.terminosPagoService.buscarPorId(dto.terminoPagoId) : null;

    let cuentaOrigen: { id: string; saldo: unknown } | null = null;
    if (tipo === 'NOTA_CREDITO') {
      if (!dto.facturaOrigenId) {
        throw new BadRequestException('Una nota de crédito debe indicar la factura de proveedor que ajusta');
      }
      // Tenant-scoped — 404 si es de otro tenant.
      const facturaOrigen = await this.facturasProveedorRepository.buscarPorId(dto.facturaOrigenId);
      if (facturaOrigen.proveedorId !== dto.proveedorId) {
        throw new BadRequestException('La factura origen no pertenece a este proveedor');
      }
      if (facturaOrigen.tipo !== 'FACTURA') {
        throw new BadRequestException('Solo se puede emitir una nota de crédito contra una factura, no contra otra nota de crédito');
      }
      if (facturaOrigen.estado === 'ANULADA') {
        throw new BadRequestException('La factura origen está anulada');
      }
      if (!facturaOrigen.cuentaPorPagar) {
        throw new BadRequestException('La factura origen no tiene una cuenta por pagar asociada');
      }
      const saldoPendiente = Number(facturaOrigen.cuentaPorPagar.saldo);
      if (total > saldoPendiente + EPSILON) {
        throw new BadRequestException(`El monto de la nota de crédito excede el saldo pendiente (RD$ ${saldoPendiente.toFixed(2)})`);
      }
      cuentaOrigen = { id: facturaOrigen.cuentaPorPagar.id, saldo: facturaOrigen.cuentaPorPagar.saldo };
    }

    const fechaVencimiento =
      tipo === 'FACTURA' ? calcularFechaVencimiento(fecha, terminoPago?.dias ?? proveedor.plazoPagoDias) : undefined;

    const facturaProveedor = await this.tenantPrisma.client.$transaction(async (tx) => {
      const creada = await this.facturasProveedorRepository.crearEnTx(tx, {
        tenantId,
        proveedorId: dto.proveedorId,
        tipo,
        facturaOrigenId: dto.facturaOrigenId,
        ncfProveedor: dto.ncfProveedor,
        tipoNcfProveedor: dto.tipoNcfProveedor,
        concepto: dto.concepto,
        subtotal,
        itbis,
        total,
        fecha,
        fechaVencimiento,
        terminoPagoId: dto.terminoPagoId,
        userId,
        lineas: lineasCalculadas,
      });

      if (tipo === 'FACTURA') {
        await this.cuentasPorPagarRepository.crearEnTx(tx, {
          tenantId,
          proveedorId: dto.proveedorId,
          facturaProveedorId: creada.id,
          terminoPagoId: dto.terminoPagoId,
          concepto: dto.concepto ?? `Factura de proveedor ${dto.ncfProveedor}`,
          monto: total,
          fecha,
          fechaVencimiento: fechaVencimiento!,
        });
      } else {
        await this.cuentasPorPagarRepository.reducirPorNotaCreditoEnTx(tx, cuentaOrigen!.id, total);
      }

      return creada;
    });

    this.eventBus.emit(EVENTOS.FACTURA_PROVEEDOR_CREADA, { tenantId, facturaProveedorId: facturaProveedor.id });

    return facturaProveedor;
  }

  /**
   * Solo tipo FACTURA sin pagos aplicados — una NOTA_CREDITO no se puede
   * anular una vez creada (mismo precedente que DevolucionCompra, que
   * tampoco se puede anular hoy: revertir su efecto sobre una
   * CuentaPorPagar que mientras tanto pudo cambiar de estado es un caso
   * borde que esta entrega no cubre).
   */
  async anular(id: string) {
    const factura = await this.facturasProveedorRepository.buscarPorIdOrThrow(id);
    if (factura.estado === 'ANULADA') {
      throw new BadRequestException('Esta factura ya está anulada');
    }
    if (factura.tipo === 'NOTA_CREDITO') {
      throw new BadRequestException('Una nota de crédito no se puede anular');
    }
    if (factura.cuentaPorPagar && Number(factura.cuentaPorPagar.saldo) !== Number(factura.cuentaPorPagar.monto)) {
      throw new BadRequestException('No se puede anular una factura que ya tiene pagos aplicados');
    }

    return this.tenantPrisma.client.$transaction(async (tx) => {
      await this.cuentasPorPagarRepository.anularPorFacturaProveedorEnTx(tx, id);
      return this.facturasProveedorRepository.anularEnTx(tx, id);
    });
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.facturasProveedorRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.facturasProveedorRepository.buscarPorId(id);
  }

  async registrarPago(id: string, dto: CrearPagoOrdenCompraDto, userId: string, tenantId: string) {
    const factura = await this.facturasProveedorRepository.buscarPorIdOrThrow(id);
    if (factura.estado === 'ANULADA') {
      throw new BadRequestException('No se puede registrar pago de una factura anulada');
    }
    if (factura.pagada) {
      throw new BadRequestException('Esta factura ya está pagada en su totalidad');
    }
    return this.pagosService.registrarPagoFacturaProveedor(factura, dto, userId, tenantId);
  }

  listarPagos(facturaProveedorId: string) {
    return this.pagosService.listarPorFacturaProveedor(facturaProveedorId);
  }
}
