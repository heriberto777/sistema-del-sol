import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PlataformaConfigRepository } from './plataforma-config.repository';
import { descifrar } from '../common/utils/encriptado.util';
import { validarUrlWebhook } from '../webhooks/ssrf-guard';

/**
 * Fase 4 — dispara el webhook de plataforma configurado en
 * /plataforma/configuracion (hasta ahora solo guardaba el dato de
 * conexión, ver el comentario de PlataformaConfiguracion.webhookUrl).
 * Mismo mecanismo criptográfico que WebhooksService (tenant-scoped,
 * HMAC-SHA256 + header X-Sol-Signature + SSRF guard), pero sin
 * reintentos — un solo destino configurado por el propio super admin,
 * no webhooks de terceros a los que haya que darles varias chances.
 */
@Injectable()
export class PlataformaWebhookChannel {
  private readonly logger = new Logger(PlataformaWebhookChannel.name);

  constructor(private readonly plataformaConfigRepository: PlataformaConfigRepository) {}

  async enviar(payload: Record<string, unknown>): Promise<boolean> {
    const config = await this.plataformaConfigRepository.obtenerOCrear();
    if (!config.webhookActivo || !config.webhookUrl) {
      this.logger.warn('Webhook de plataforma no activo/configurado — notificación no enviada');
      return false;
    }

    try {
      await validarUrlWebhook(config.webhookUrl);
    } catch (error) {
      this.logger.error(`Webhook de plataforma bloqueado por el SSRF guard: ${(error as Error).message}`);
      return false;
    }

    const cuerpo = JSON.stringify({ ...payload, timestamp: new Date().toISOString() });
    const firma = config.webhookSecretCifrado ? createHmac('sha256', descifrar(config.webhookSecretCifrado)).update(cuerpo).digest('hex') : undefined;

    try {
      const respuesta = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(firma ? { 'X-Sol-Signature': firma } : {}) },
        body: cuerpo,
        signal: AbortSignal.timeout(5000),
      });
      if (!respuesta.ok) {
        this.logger.warn(`Webhook de plataforma respondió ${respuesta.status}`);
      }
      return respuesta.ok;
    } catch (error) {
      this.logger.error(`Fallo al llamar al webhook de plataforma: ${(error as Error).message}`);
      return false;
    }
  }
}
