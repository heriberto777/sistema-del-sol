import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PagosPlataformaRepository } from './pagos-plataforma.repository';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { FacturasPlataformaService } from './facturas-plataforma.service';
import { CrearPagoPlataformaDto } from './dto/crear-pago-plataforma.dto';

const EPSILON = 0.005; // tolerancia de redondeo en centavos, igual que PagosService de tenant

@Injectable()
export class PagosPlataformaService {
  private readonly logger = new Logger(PagosPlataformaService.name);

  constructor(
    private readonly pagosPlataformaRepository: PagosPlataformaRepository,
    private readonly facturasPlataformaRepository: FacturasPlataformaRepository,
    private readonly facturasPlataformaService: FacturasPlataformaService,
  ) {}

  async registrar(facturaId: string, dto: CrearPagoPlataformaDto, registradoPorId: string) {
    const factura = await this.facturasPlataformaRepository.buscarPorId(facturaId);
    if (factura.estado === 'PAGADA' || factura.estado === 'ANULADA') {
      throw new BadRequestException(`No se puede registrar un pago sobre una factura ${factura.estado.toLowerCase()}`);
    }

    const pagadoAntes = await this.pagosPlataformaRepository.sumaPagosFactura(facturaId);
    const total = Number(factura.total);
    const pendiente = total - pagadoAntes;
    if (dto.monto > pendiente + EPSILON) {
      throw new BadRequestException(`El monto excede el saldo pendiente (RD$ ${pendiente.toFixed(2)})`);
    }

    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    const pago = await this.pagosPlataformaRepository.crear({
      facturaId,
      monto: dto.monto,
      metodoPago: dto.metodoPago,
      referencia: dto.referencia,
      fecha,
      registradoPorId,
    });

    if (pendiente - dto.monto <= EPSILON) {
      await this.facturasPlataformaService.marcarPagada(facturaId, fecha);
    }

    return pago;
  }

  /**
   * Registrado por el webhook de la pasarela de pago, nunca por un
   * admin de plataforma (registradoPorId: null). Idempotente de verdad:
   * Stripe reintenta el webhook si no recibe 200, y `referenciaExterna`
   * es el id de la sesión de checkout de Stripe (único por intento de
   * pago) — antes de insertar, se busca un pago ya registrado con esa
   * misma (facturaId, referencia) y, si existe, se devuelve sin tocar
   * nada más (bug real: el único guard previo era el estado de la
   * factura, que no protege un reintento mientras sigue PENDIENTE tras
   * un pago parcial).
   *
   * El monto nunca se valida contra el saldo pendiente con una
   * excepción (a diferencia de `registrar`): acá el cobro YA se hizo en
   * Stripe, así que igual se registra el pago (perderlo sería perder el
   * rastro de dinero real) — si excede el pendiente, solo se loguea una
   * advertencia para revisión manual.
   */
  async registrarPagoGateway(facturaId: string, params: { monto: number; referenciaExterna: string }) {
    const factura = await this.facturasPlataformaRepository.buscarPorId(facturaId);

    const pagoExistente = await this.pagosPlataformaRepository.buscarPorFacturaYReferencia(facturaId, params.referenciaExterna);
    if (pagoExistente) {
      this.logger.log(`Webhook de pago reintentado para la factura ${facturaId} (referencia ${params.referenciaExterna}) — ya estaba registrado, no se duplica`);
      return pagoExistente;
    }

    if (factura.estado === 'PAGADA' || factura.estado === 'ANULADA') {
      this.logger.warn(`Webhook de pago recibido para una factura ya ${factura.estado} — ignorado (${facturaId})`);
      return null;
    }

    const pagadoAntes = await this.pagosPlataformaRepository.sumaPagosFactura(facturaId);
    const total = Number(factura.total);
    const pendiente = total - pagadoAntes;
    if (params.monto > pendiente + EPSILON) {
      this.logger.warn(`Pago vía gateway (${params.referenciaExterna}) por RD$ ${params.monto.toFixed(2)} excede el saldo pendiente (RD$ ${pendiente.toFixed(2)}) de la factura ${facturaId} — se registra igual, revisar manualmente`);
    }

    const fecha = new Date();
    const pago = await this.pagosPlataformaRepository.crear({
      facturaId,
      monto: params.monto,
      metodoPago: 'TARJETA',
      referencia: params.referenciaExterna,
      fecha,
      registradoPorId: null,
    });

    const totalPagado = await this.pagosPlataformaRepository.sumaPagosFactura(facturaId);
    if (total - totalPagado <= EPSILON) {
      await this.facturasPlataformaService.marcarPagada(facturaId, fecha);
    }

    return pago;
  }

  async listarPorFactura(facturaId: string) {
    const [pagos, totalPagado] = await Promise.all([
      this.pagosPlataformaRepository.listarPorFactura(facturaId),
      this.pagosPlataformaRepository.sumaPagosFactura(facturaId),
    ]);
    return { pagos, totalPagado };
  }
}
