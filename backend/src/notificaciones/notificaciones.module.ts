import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesRepository } from './notificaciones.repository';
import { EmailChannel } from './canales/email.channel';
import { WhatsAppChannel } from './canales/whatsapp.channel';

@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService, NotificacionesRepository, EmailChannel, WhatsAppChannel],
  exports: [NotificacionesService, EmailChannel, WhatsAppChannel],
})
export class NotificacionesModule {}
