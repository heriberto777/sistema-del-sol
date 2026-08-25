import { Injectable, Logger } from '@nestjs/common';
import { enviarWhatsappTwilio } from '../../common/utils/twilio-whatsapp.util';

/**
 * Vía la API de WhatsApp de Twilio (REST directo, sin el SDK oficial —
 * es solo Basic Auth + un POST form-urlencoded, no justifica una
 * dependencia nueva). Igual que EmailChannel: si faltan las credenciales
 * (TWILIO_*), no falla — solo loguea y no envía, para que el resto del
 * flujo (guardar la notificación, etc.) funcione igual en dev sin cuenta
 * de Twilio configurada. La llamada HTTP en sí vive en
 * `enviarWhatsappTwilio` (`common/utils/twilio-whatsapp.util.ts`) —
 * reusada tal cual por el bot de WhatsApp (ítem H-2b) con las
 * credenciales del tenant en vez de las de plataforma.
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
      const enviado = await enviarWhatsappTwilio({ accountSid, authToken, from, to: destinatario, body: cuerpo });
      if (!enviado) {
        this.logger.error(`Twilio respondió con error al enviar WhatsApp a ${destinatario}`);
      }
      return enviado;
    } catch (error) {
      this.logger.error(`Fallo al enviar WhatsApp a ${destinatario}`, error as Error);
      return false;
    }
  }
}
