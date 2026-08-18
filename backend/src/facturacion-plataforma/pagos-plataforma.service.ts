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
   * admin de plataforma (registradoPorId: null). Idempotente a
   * propósito: Stripe reintenta el webhook si no recibe 200, así que
   * debe poder llamarse de nuevo sin duplicar el pago ni tirar una
   * excepción que dispare más reintentos.
   */
  async registrarPagoGateway(facturaId: string, params: { monto: number; referenciaExterna: string }) {
    const factura = await this.facturasPlataformaRepository.buscarPorId(facturaId);
    if (factura.estado === 'PAGADA' || factura.estado === 'ANULADA') {
      this.logger.warn(`Webhook de pago recibido para una factura ya ${factura.estado} — ignorado (${facturaId})`);
      return null;
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
    const total = Number(factura.total);
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
