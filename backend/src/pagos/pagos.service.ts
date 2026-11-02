import { BadRequestException, Injectable } from '@nestjs/common';
import { PagosRepository } from './pagos.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearPagoDto } from './dto/crear-pago.dto';
import type { CrearPagoOrdenCompraDto } from '../compras/dto/crear-pago-orden-compra.dto';
import { CierrePeriodoService } from '../contabilidad/cierre-periodo.service';
import { FormasPagoRepository } from '../formas-pago/formas-pago.repository';
import { CuentasPorPagarRepository } from '../cuentas-por-pagar/cuentas-por-pagar.repository';

const EPSILON = 0.005; // tolerancia de redondeo en centavos, igual que AsientosContablesService/PagosPlataformaService

@Injectable()
export class PagosService {
  constructor(
    private readonly pagosRepository: PagosRepository,
    private readonly eventBus: EventBusService,
    private readonly cierrePeriodoService: CierrePeriodoService,
    private readonly formasPagoRepository: FormasPagoRepository,
    private readonly cuentasPorPagarRepository: CuentasPorPagarRepository,
  ) {}

  /**
   * Compartido por Facturación y Compras — cada uno valida las reglas
   * propias de su documento (estado, tipo) ANTES de llamar acá. Fase 3
   * (CxC como ledger real): reemplaza el viejo ledger `Pago` por
   * `ReciboIngreso`/`AplicacionCobro` contra la `CuentaPorCobrar` real de
   * la factura — que `PagosRepository.registrarCobroFactura` crea sola si
   * todavía no existe (caso degenerado: una factura CONTADO creada sin
   * forma de pago, ver FacturacionService.crear/pagadaAlCrear, queda
   * `pagada:false` sin CuentaPorCobrar propia — antes de esto, un cobro
   * post-hoc contra ella solo dejaba un `Pago` suelto sin ledger alguno).
   */
  async registrarPagoFactura(
    factura: { id: string; total: unknown; clienteId: string; fecha: Date; plazoPagoDias: number },
    dto: CrearPagoDto,
    userId: string | null,
    tenantId: string,
  ) {
    const pendienteExistente = await this.pagosRepository.pendienteFactura(factura.id);
    const pendiente = pendienteExistente ?? Number(factura.total);
    if (dto.monto > pendiente + EPSILON) {
      throw new BadRequestException(`El monto excede el saldo pendiente (RD$ ${pendiente.toFixed(2)})`);
    }

    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    await this.cierrePeriodoService.validarFechaAbierta(fecha);
    // Tenant-scoped: 404 si formaPagoId es de otro tenant.
    await this.formasPagoRepository.buscarPorId(dto.formaPagoId);

    const reciboIngreso = await this.pagosRepository.registrarCobroFactura({
      tenantId,
      facturaId: factura.id,
      clienteId: factura.clienteId,
      facturaFecha: factura.fecha,
      facturaPlazoPagoDias: factura.plazoPagoDias,
      facturaTotal: Number(factura.total),
      monto: dto.monto,
      formaPagoId: dto.formaPagoId,
      referencia: dto.referencia,
      fecha,
      userId,
    });

    this.eventBus.emit(EVENTOS.PAGO_FACTURA_REGISTRADO, {
      tenantId,
      pagoId: reciboIngreso.id,
      facturaId: factura.id,
      monto: dto.monto.toString(),
    });

    return reciboIngreso;
  }

  /**
   * Fase 3 (CxP como ledger real): reemplaza `Pago.ordenCompraId` por
   * `OrdenPago`/`AplicacionPago`. La orden puede tener varias
   * `CuentaPorPagar` abiertas (una por recepción, ver Fase 2) —
   * `PagosRepository.registrarCobroOrdenCompra` reparte el pago FIFO entre
   * ellas y crea una `AplicacionPago` por cada una efectivamente tocada,
   * todo en una sola transacción.
   */
  async registrarPagoOrdenCompra(
    orden: { id: string; total: unknown; proveedorId: string; fecha: Date; proveedor: { plazoPagoDias: number } },
    dto: CrearPagoOrdenCompraDto,
    userId: string,
    tenantId: string,
  ) {
    const pendiente = await this.cuentasPorPagarRepository.pendienteDeOrden(orden.id, Number(orden.total));
    if (dto.monto > pendiente + EPSILON) {
      throw new BadRequestException(`El monto excede el saldo pendiente (RD$ ${pendiente.toFixed(2)})`);
    }

    const retencionIsr = dto.retencionIsr ?? 0;
    const retencionItbis = dto.retencionItbis ?? 0;
    if (retencionIsr + retencionItbis > dto.monto + EPSILON) {
      throw new BadRequestException('La retención no puede superar el monto del pago');
    }

    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    await this.cierrePeriodoService.validarFechaAbierta(fecha);
    await this.formasPagoRepository.buscarPorId(dto.formaPagoId);

    const ordenPago = await this.pagosRepository.registrarCobroOrdenCompra({
      tenantId,
      ordenCompraId: orden.id,
      proveedorId: orden.proveedorId,
      ordenFecha: orden.fecha,
      ordenTotal: Number(orden.total),
      proveedorPlazoPagoDias: orden.proveedor.plazoPagoDias,
      monto: dto.monto,
      retencionIsr,
      retencionItbis,
      formaPagoId: dto.formaPagoId,
      referencia: dto.referencia,
      fecha,
      userId,
    });

    this.eventBus.emit(EVENTOS.PAGO_ORDEN_COMPRA_REGISTRADO, {
      tenantId,
      pagoId: ordenPago.id,
      ordenCompraId: orden.id,
      monto: dto.monto.toString(),
      retencionIsr: retencionIsr.toString(),
      retencionItbis: retencionItbis.toString(),
    });

    return ordenPago;
  }

  /**
   * Fase 5 (CxP) — reemplaza el flujo FIFO de `registrarPagoOrdenCompra`
   * por el caso simple: una FacturaProveedor tiene exactamente UNA
   * CuentaPorPagar, así que el pendiente es directo (su `saldo`), sin
   * reparto entre varias filas.
   */
  async registrarPagoFacturaProveedor(
    facturaProveedor: { id: string; proveedorId: string },
    dto: CrearPagoOrdenCompraDto,
    userId: string,
    tenantId: string,
  ) {
    const pendiente = await this.pagosRepository.pendienteFacturaProveedor(facturaProveedor.id);
    if (dto.monto > pendiente + EPSILON) {
      throw new BadRequestException(`El monto excede el saldo pendiente (RD$ ${pendiente.toFixed(2)})`);
    }

    const retencionIsr = dto.retencionIsr ?? 0;
    const retencionItbis = dto.retencionItbis ?? 0;
    if (retencionIsr + retencionItbis > dto.monto + EPSILON) {
      throw new BadRequestException('La retención no puede superar el monto del pago');
    }

    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    await this.cierrePeriodoService.validarFechaAbierta(fecha);
    await this.formasPagoRepository.buscarPorId(dto.formaPagoId);

    const ordenPago = await this.pagosRepository.registrarCobroFacturaProveedor({
      tenantId,
      facturaProveedorId: facturaProveedor.id,
      proveedorId: facturaProveedor.proveedorId,
      monto: dto.monto,
      retencionIsr,
      retencionItbis,
      formaPagoId: dto.formaPagoId,
      referencia: dto.referencia,
      fecha,
      userId,
    });

    this.eventBus.emit(EVENTOS.PAGO_FACTURA_PROVEEDOR_REGISTRADO, {
      tenantId,
      pagoId: ordenPago.id,
      facturaProveedorId: facturaProveedor.id,
      monto: dto.monto.toString(),
      retencionIsr: retencionIsr.toString(),
      retencionItbis: retencionItbis.toString(),
    });

    return ordenPago;
  }

  listarPorFacturaProveedor(facturaProveedorId: string) {
    return this.pagosRepository.listarPorFacturaProveedor(facturaProveedorId);
  }

  /**
   * Passthrough de `PagosRepository` — expuesto para que otros módulos
   * (ej. FacturacionService, al validar si una factura "tiene cobro
   * registrado" antes de emitirle una nota) no tengan que importar el
   * repositorio de este módulo directo, mismo criterio
   * Controller→Service→Repository del resto del proyecto.
   */
  sumaPagosFactura(facturaId: string) {
    return this.pagosRepository.sumaCobrosFactura(facturaId);
  }

  async sumaPagosPorFacturas(facturaIds: string[]): Promise<Map<string, number>> {
    const filas = await this.pagosRepository.sumaCobrosPorFacturas(facturaIds);
    return new Map(filas.map((f) => [f.facturaId as string, Number(f._sum.monto ?? 0)]));
  }

  listarPorFactura(facturaId: string) {
    return this.pagosRepository.listarPorFactura(facturaId);
  }

  listarPorOrdenCompra(ordenCompraId: string) {
    return this.pagosRepository.listarPorOrdenCompra(ordenCompraId);
  }
}
