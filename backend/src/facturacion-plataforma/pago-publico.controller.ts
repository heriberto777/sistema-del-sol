import { BadRequestException, Controller, Get, Headers, Logger, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { PagosPlataformaService } from './pagos-plataforma.service';
import { PasarelaPagoService } from './pasarela/pasarela-pago.service';
import { verificarFirmaStripe } from './pasarela/stripe-webhook.util';

interface StripeCheckoutSessionCompleted {
  type: string;
  data: { object: { id: string; amount_total: number | null; metadata?: { facturaId?: string } } };
}

/**
 * Rutas sin autenticación a propósito: quien paga es el admin del
 * tenant, que llega desde un link de email — no tiene (ni necesita)
 * sesión de plataforma ni de tenant para esto. Prefijo "pagos-publicos"
 * para no chocar con /api/facturas (tenant) ni /api/platform/facturas.
 */
@ApiTags('pagos-publicos')
@Public()
@Controller('pagos-publicos')
export class PagoPublicoController {
  private readonly logger = new Logger(PagoPublicoController.name);

  constructor(
    private readonly facturasPlataformaRepository: FacturasPlataformaRepository,
    private readonly pagosPlataformaService: PagosPlataformaService,
    private readonly pasarelaPagoService: PasarelaPagoService,
  ) {}

  @Get('facturas/:facturaId')
  async buscarFactura(@Param('facturaId') facturaId: string) {
    const factura = await this.facturasPlataformaRepository.buscarPorId(facturaId);
    const { totalPagado } = await this.pagosPlataformaService.listarPorFactura(facturaId);
    const pendiente = Math.max(Number(factura.total) - totalPagado, 0);

    return {
      tenant: { nombre: factura.tenant.nombre },
      concepto: factura.concepto,
      total: factura.total,
      pendiente,
      estado: factura.estado,
      fechaVencimiento: factura.fechaVencimiento,
    };
  }

  @Post('facturas/:facturaId/checkout')
  async crearCheckout(@Param('facturaId') facturaId: string) {
    const factura = await this.facturasPlataformaRepository.buscarPorId(facturaId);
    if (factura.estado === 'PAGADA' || factura.estado === 'ANULADA') {
      throw new BadRequestException(`No se puede pagar una factura ${factura.estado.toLowerCase()}`);
    }

    const { totalPagado } = await this.pagosPlataformaService.listarPorFactura(facturaId);
    const pendiente = Number(factura.total) - totalPagado;
    if (pendiente <= 0) {
      throw new BadRequestException('Esta factura no tiene saldo pendiente');
    }

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    return this.pasarelaPagoService.activa.crearSesionPago({
      facturaId,
      concepto: factura.concepto,
      montoPendiente: pendiente,
      successUrl: `${frontendUrl}/pagar/${facturaId}/exito`,
      cancelUrl: `${frontendUrl}/pagar/${facturaId}/cancelado`,
    });
  }

  @Post('webhook/stripe')
  async webhookStripe(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') firma: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !req.rawBody || !verificarFirmaStripe(req.rawBody, firma, secret)) {
      throw new BadRequestException('Firma de webhook inválida');
    }

    const evento = JSON.parse(req.rawBody.toString('utf8')) as StripeCheckoutSessionCompleted;
    if (evento.type !== 'checkout.session.completed') {
      return { recibido: true };
    }

    const sesion = evento.data.object;
    const facturaId = sesion.metadata?.facturaId;
    if (!facturaId || sesion.amount_total == null) {
      this.logger.warn('Webhook de Stripe sin facturaId/amount_total en metadata — ignorado');
      return { recibido: true };
    }

    await this.pagosPlataformaService.registrarPagoGateway(facturaId, {
      monto: sesion.amount_total / 100,
      referenciaExterna: sesion.id,
    });

    return { recibido: true };
  }
}
