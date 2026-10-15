import { BadRequestException, Controller, Headers, HttpCode, Logger, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { DuffelWebhookEvento, verificarFirmaDuffel } from './duffel-webhook.util';
import { DuffelWebhookService } from './duffel-webhook.service';

/**
 * Sin `@RequiereModulo('travel')` a propósito — es un webhook público,
 * sin tenant conocido de antemano; si un tenant desactivó el módulo
 * Travel después de reservar, el webhook igual debe poder marcar la
 * alerta.
 *
 * Cada tenant tiene su PROPIA cuenta de Duffel (y su propio webhook
 * secret) — a diferencia de cuando había una única cuenta compartida, acá
 * no hay un solo secreto posible para validar la firma de entrada. Se
 * resuelve el tenant PRIMERO por un dato del evento (el id de la orden,
 * cruzado contra `TravelReserva.proveedorOrdenId`) y RECIÉN DESPUÉS se
 * valida la firma con el secreto de ESE tenant — mismo patrón ya probado
 * en `WhatsappWebhookController` (resuelve por el número `To` antes de
 * validar la firma de Twilio). Resolver el tenant con un dato público del
 * body nunca es un problema de seguridad: la firma sigue siendo la única
 * puerta para que el evento tenga cualquier efecto.
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
    if (!req.rawBody) {
      throw new BadRequestException('Firma de webhook inválida');
    }

    let evento: DuffelWebhookEvento;
    try {
      evento = JSON.parse(req.rawBody.toString('utf8'));
    } catch {
      this.logger.warn('Webhook de Duffel con un body que no es JSON válido');
      return { recibido: true };
    }

    const tenantId = await this.duffelWebhookService.resolverTenantPorEvento(evento);
    if (!tenantId) {
      this.logger.warn('Webhook de Duffel: no se pudo resolver a qué tenant pertenece (ninguna reserva coincide con el id de orden del evento)');
      return { recibido: true };
    }

    const secret = await this.duffelWebhookService.obtenerSecretoWebhook(tenantId);
    if (!secret || !verificarFirmaDuffel(req.rawBody, firma, secret)) {
      throw new BadRequestException('Firma de webhook inválida');
    }

    await this.duffelWebhookService.procesarEvento(evento, tenantId);
    return { recibido: true };
  }
}
