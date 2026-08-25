import { BadRequestException, Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WhatsappBotService } from './whatsapp-bot.service';
import { Public } from '../common/decorators/public.decorator';

/**
 * Webhook entrante de Twilio (ítem H-2b) — `@Public()`, sin JWT. Todos
 * los tenants apuntan a la MISMA URL (configurada en su consola de
 * Twilio, ver `WHATSAPP_WEBHOOK_URL`) — el tenant se resuelve por el
 * campo `To` (el número de WhatsApp del negocio), no por la URL. Mismo
 * criterio de "nunca romper el contrato con el proveedor" que el webhook
 * de Stripe: cualquier caso no accionable responde 200 vacío en vez de
 * un error.
 */
@ApiTags('whatsapp-webhook')
@Public()
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  constructor(private readonly whatsappBotService: WhatsappBotService) {}

  @Post('inbound')
  @HttpCode(200)
  async inbound(@Body() body: Record<string, string>, @Headers('x-twilio-signature') firma: string | undefined) {
    const { To: to, From: from, Body: mensaje } = body;
    if (!to || !from || mensaje === undefined) return {};

    const config = await this.whatsappBotService.resolverConfigPorNumero(to);
    if (!config || !config.habilitado) return {};

    const urlCompleta = process.env.WHATSAPP_WEBHOOK_URL ?? '';
    if (!this.whatsappBotService.verificarFirma(config, urlCompleta, body, firma)) {
      throw new BadRequestException('Firma de webhook inválida');
    }

    await this.whatsappBotService.procesarMensajeEntrante(config, from, mensaje);
    return {};
  }
}
