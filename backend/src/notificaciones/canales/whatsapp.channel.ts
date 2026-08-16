import { Injectable, Logger } from '@nestjs/common';

/**
 * Vía la API de WhatsApp de Twilio (REST directo, sin el SDK oficial —
 * es solo Basic Auth + un POST form-urlencoded, no justifica una
 * dependencia nueva). Igual que EmailChannel: si faltan las credenciales
 * (TWILIO_*), no falla — solo loguea y no envía, para que el resto del
 * flujo (guardar la notificación, etc.) funcione igual en dev sin cuenta
 * de Twilio configurada.
 */
@Injectable()
export class WhatsAppChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);

  async enviar(destinatario: string, _asunto: string, cuerpo: string): Promise<boolean> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;

    if (!accountSid || !authToken || !from) {
      this.logger.warn(`TWILIO_* no configurado — WhatsApp a ${destinatario} no enviado`);
      return false;
    }

    try {
      const respuesta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: from,
          To: `whatsapp:${destinatario}`,
          Body: cuerpo,
        }),
      });

      if (!respuesta.ok) {
        this.logger.error(`Twilio respondió ${respuesta.status} al enviar WhatsApp a ${destinatario}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(`Fallo al enviar WhatsApp a ${destinatario}`, error as Error);
      return false;
    }
  }
}
