import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { descifrar } from '../../common/utils/encriptado.util';
import { enviarWhatsappTwilio } from '../../common/utils/twilio-whatsapp.util';

interface ConfigTwilio {
  accountSid: string;
  authToken: string;
  from: string;
}

/**
 * Vía la API de WhatsApp de Twilio (REST directo, sin el SDK oficial —
 * es solo Basic Auth + un POST form-urlencoded, no justifica una
 * dependencia nueva). Igual que EmailChannel: si faltan las credenciales,
 * no falla — solo loguea y no envía, para que el resto del flujo
 * (guardar la notificación, etc.) funcione igual en dev sin cuenta de
 * Twilio configurada. La llamada HTTP en sí vive en `enviarWhatsappTwilio`
 * (`common/utils/twilio-whatsapp.util.ts`).
 */
@Injectable()
export class WhatsAppChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);

  // PrismaService global (no TenantPrismaService) — mismo motivo que
  // EmailChannel: se llama también desde @OnEvent fuera de contexto de
  // request (ver notificaciones.service.ts).
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Si el tenant tiene su propio Twilio (Integraciones) habilitado y
   * completo, se usa para todo SU WhatsApp saliente genérico (recordatorios
   * de tarea/hito, reporte de incentivo, etc.) — antes esto SIEMPRE salía
   * con el Twilio de Plataforma (un solo número para todo el SaaS), aunque
   * el tenant ya tuviera el suyo propio configurado para su bot/Integraciones
   * (bug real: un tenant con Twilio propio armado igual veía fallar estos
   * envíos si Plataforma nunca cargó el suyo). Mismo criterio que
   * EmailChannel.resolverConfig — sin reintento contra el de Plataforma si
   * el del tenant falla.
   */
  private async resolverConfig(tenantId?: string): Promise<ConfigTwilio | null> {
    if (tenantId) {
      const config = await this.prisma.whatsappConfigTenant.findUnique({ where: { tenantId } });
      if (config?.habilitado && config.twilioAccountSid && config.twilioAuthTokenCifrado && config.twilioWhatsappFrom) {
        return {
          accountSid: config.twilioAccountSid,
          authToken: descifrar(config.twilioAuthTokenCifrado),
          from: config.twilioWhatsappFrom,
        };
      }
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!accountSid || !authToken || !from) return null;
    return { accountSid, authToken, from };
  }

  async enviar(destinatario: string, _asunto: string, cuerpo: string, tenantId?: string): Promise<boolean> {
    const config = await this.resolverConfig(tenantId);
    if (!config) {
      this.logger.warn(`Twilio no configurado (ni del tenant ni de Plataforma) — WhatsApp a ${destinatario} no enviado`);
      return false;
    }
    const { accountSid, authToken, from } = config;

    try {
      // Twilio exige el prefijo "whatsapp:" en AMBOS extremos (From y To) para
      // enrutar como WhatsApp — sin él en "From", lo trata como SMS normal y
      // lo rechaza (número no habilitado para SMS). Mismo criterio que ya
      // usan whatsapp-bot/publicaciones-sociales/notificaciones (aprobación
      // por tenant) al armar este mismo `from`.
      const enviado = await enviarWhatsappTwilio({ accountSid, authToken, from: `whatsapp:${from}`, to: destinatario, body: cuerpo });
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
