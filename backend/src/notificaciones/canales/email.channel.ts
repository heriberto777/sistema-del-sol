import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { descifrar } from '../../common/utils/encriptado.util';

interface ConfigSmtp {
  host?: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);

  // PrismaService global (no TenantPrismaService) — EmailChannel se llama
  // también desde @OnEvent fuera de contexto de request (ver
  // notificaciones.service.ts), donde TenantPrismaService no aplica (ver
  // docs/ARCHITECTURE.md).
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Si el tenant tiene su propio SMTP habilitado y con host cargado, se usa
   * para TODO su correo (decisión explícita: una vez configurado, ninguna
   * notificación de ese tenant vuelve a salir del SMTP de plataforma, para
   * que las respuestas del destinatario lleguen a la bandeja real del
   * tenant). Sin reintento contra el SMTP de plataforma si el del tenant
   * falla — el tenant debe corregir su configuración.
   */
  private async resolverConfig(tenantId?: string): Promise<ConfigSmtp | null> {
    if (tenantId) {
      const config = await this.prisma.emailConfigTenant.findUnique({ where: { tenantId } });
      if (config?.habilitado && config.smtpHost) {
        return {
          host: config.smtpHost,
          port: config.smtpPort ?? 587,
          user: config.smtpUser ?? undefined,
          password: config.smtpPasswordCifrado ? descifrar(config.smtpPasswordCifrado) : undefined,
          from: config.smtpFrom ?? 'no-reply@sistemadelsol.com',
        };
      }
    }

    if (process.env.EMAIL_HABILITADO !== 'true') return null;
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM ?? 'no-reply@sistemadelsol.com',
    };
  }

  async enviar(
    destinatario: string,
    asunto: string,
    cuerpo: string,
    // Ítem H-4 — PDF de la Factura/Cotización adjunto (además del link
    // `{{link}}` en el cuerpo, que además sirve para WhatsApp, sin
    // adjunto posible ahí). Opcional: los demás envíos (stock_bajo, etc.)
    // no mandan ninguno.
    adjuntos?: { filename: string; content: Buffer }[],
    // Presente en todo envío tenant-scoped (ver callers) — ausente solo en
    // los 2 envíos que son de la propia Plataforma hacia un tenant/admin
    // de plataforma (factura de plataforma, recuperación de super admin),
    // que siempre usan el SMTP de Plataforma.
    tenantId?: string,
  ): Promise<boolean> {
    const config = await this.resolverConfig(tenantId);
    if (!config) {
      this.logger.warn(`Email deshabilitado — notificación a ${destinatario} no enviada`);
      return false;
    }

    // El transporter se arma fresco en cada envío (no como campo de
    // clase) para que un cambio de configuración guardado desde
    // /plataforma/configuracion (PlataformaConfigService.sincronizarEnv) o
    // /admin/email-config aplique sin reiniciar el backend.
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
    });

    try {
      await transporter.sendMail({
        from: config.from,
        to: destinatario,
        subject: asunto,
        html: cuerpo,
        attachments: adjuntos,
      });
      return true;
    } catch (error) {
      this.logger.error(`Fallo al enviar email a ${destinatario}`, error as Error);
      return false;
    }
  }
}
