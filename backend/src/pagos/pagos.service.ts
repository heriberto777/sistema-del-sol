import { BadRequestException, Injectable } from '@nestjs/common';
import { PagosRepository } from './pagos.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearPagoDto } from './dto/crear-pago.dto';
import type { CrearPagoOrdenCompraDto } from '../compras/dto/crear-pago-orden-compra.dto';

const EPSILON = 0.005; // tolerancia de redondeo en centavos, igual que AsientosContablesService

@Injectable()
export class PagosService {
  constructor(
    private readonly pagosRepository: PagosRepository,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Compartido por Facturación y Compras — cada uno valida las reglas
   * propias de su documento (estado, tipo) ANTES de llamar acá; esto solo
   * sabe de "ledger de pagos parciales contra un total", sin acoplarse a
   * qué es un `Factura` o una `OrdenCompra`.
   */
  async registrarPagoFactura(factura: { id: string; total: unknown }, dto: CrearPagoDto, userId: string, tenantId: string) {
    const pagadoAntes = await this.pagosRepository.sumaPagosFactura(factura.id);
    const total = Number(factura.total);
    const pendiente = total - pagadoAntes;
    if (dto.monto > pendiente + EPSILON) {
      throw new BadRequestException(`El monto excede el saldo pendiente (RD$ ${pendiente.toFixed(2)})`);
    }

    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    const pago = await this.pagosRepository.crear({
      tenantId,
      facturaId: factura.id,
      monto: dto.monto,
      metodoPago: dto.metodoPago,
      fecha,
      userId,
    });

    if (pendiente - dto.monto <= EPSILON) {
      await this.pagosRepository.marcarFacturaPagada(factura.id, fecha);
    }

    this.eventBus.emit(EVENTOS.PAGO_FACTURA_REGISTRADO, {
      tenantId,
      pagoId: pago.id,
      facturaId: factura.id,
      monto: dto.monto.toString(),
    });

    return pago;
  }

  async registrarPagoOrdenCompra(orden: { id: string; total: unknown }, dto: CrearPagoOrdenCompraDto, userId: string, tenantId: string) {
    const pagadoAntes = await this.pagosRepository.sumaPagosOrdenCompra(orden.id);
    const total = Number(orden.total);
    const pendiente = total - pagadoAntes;
    if (dto.monto > pendiente + EPSILON) {
      throw new BadRequestException(`El monto excede el saldo pendiente (RD$ ${pendiente.toFixed(2)})`);
    }

    const retencionIsr = dto.retencionIsr ?? 0;
    const retencionItbis = dto.retencionItbis ?? 0;
    if (retencionIsr + retencionItbis > dto.monto + EPSILON) {
      throw new BadRequestException('La retención no puede superar el monto del pago');
    }

    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    const pago = await this.pagosRepository.crear({
      tenantId,
      ordenCompraId: orden.id,
      monto: dto.monto,
      retencionIsr,
      retencionItbis,
      metodoPago: dto.metodoPago,
      fecha,
      userId,
    });

    if (pendiente - dto.monto <= EPSILON) {
      await this.pagosRepository.marcarOrdenCompraPagada(orden.id, fecha);
    }

    this.eventBus.emit(EVENTOS.PAGO_ORDEN_COMPRA_REGISTRADO, {
      tenantId,
      pagoId: pago.id,
      ordenCompraId: orden.id,
      monto: dto.monto.toString(),
      retencionIsr: retencionIsr.toString(),
      retencionItbis: retencionItbis.toString(),
    });

    return pago;
  }

  async listarPorFactura(facturaId: string) {
    const [pagos, totalPagado] = await Promise.all([
      this.pagosRepository.listarPorFactura(facturaId),
      this.pagosRepository.sumaPagosFactura(facturaId),
    ]);
    return { pagos, totalPagado };
  }

  async listarPorOrdenCompra(ordenCompraId: string) {
    const [pagos, totalPagado] = await Promise.all([
      this.pagosRepository.listarPorOrdenCompra(ordenCompraId),
      this.pagosRepository.sumaPagosOrdenCompra(ordenCompraId),
    ]);
    return { pagos, totalPagado };
  }
}
