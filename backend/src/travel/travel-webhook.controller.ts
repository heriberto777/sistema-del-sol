import { BadRequestException, Controller, Headers, HttpCode, Logger, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { verificarFirmaDuffel } from './duffel-webhook.util';
import { DuffelWebhookService } from './duffel-webhook.service';

/**
 * Sin `@RequiereModulo('travel')` a propósito — es un webhook público,
 * sin tenant conocido; si un tenant desactivó el módulo Travel después
 * de reservar, el webhook igual debe poder marcar la alerta.
 */
@ApiTags('webhooks-duffel')
@Public()
@Controller('webhooks/duffel')
export class TravelWebhookController {
  private readonly logger = new Logger(TravelWebhookController.name);

  constructor(private readonly duffelWebhookService: DuffelWebhookService) {}

  @Post()
  @HttpCode(200)
  async recibir(@Req() req: RawBodyRequest<Request>, @Headers('x-duffel-signature') firma: string | undefined) {
    const secret = process.env.DUFFEL_WEBHOOK_SECRET;
    if (!secret || !req.rawBody || !verificarFirmaDuffel(req.rawBody, firma, secret)) {
      throw new BadRequestException('Firma de webhook inválida');
    }

    let evento: { type?: string; object_id?: string; data?: Record<string, unknown> };
    try {
      evento = JSON.parse(req.rawBody.toString('utf8'));
    } catch {
      this.logger.warn('Webhook de Duffel con un body que no es JSON válido');
      return { recibido: true };
    }

    await this.duffelWebhookService.procesarEvento(evento);
    return { recibido: true };
  }
}
