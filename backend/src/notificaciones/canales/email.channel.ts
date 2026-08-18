import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);

  async enviar(destinatario: string, asunto: string, cuerpo: string): Promise<boolean> {
    if (process.env.EMAIL_HABILITADO !== 'true') {
      this.logger.warn(`EMAIL_HABILITADO=false — notificación a ${destinatario} no enviada`);
      return false;
    }

    // El transporter se arma fresco en cada envío (no como campo de
    // clase) para que un cambio de configuración guardado desde
    // /plataforma/configuracion (PlataformaConfigService.sincronizarEnv)
    // aplique sin reiniciar el backend.
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'no-reply@sistemadelsol.com',
        to: destinatario,
        subject: asunto,
        html: cuerpo,
      });
      return true;
    } catch (error) {
      this.logger.error(`Fallo al enviar email a ${destinatario}`, error as Error);
      return false;
    }
  }
}
