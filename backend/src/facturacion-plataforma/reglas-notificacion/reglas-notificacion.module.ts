import { Module } from '@nestjs/common';
import { ReglasNotificacionController } from './reglas-notificacion.controller';
import { ReglasNotificacionService } from './reglas-notificacion.service';
import { ReglasNotificacionRepository } from './reglas-notificacion.repository';

@Module({
  controllers: [ReglasNotificacionController],
  providers: [ReglasNotificacionService, ReglasNotificacionRepository],
  exports: [ReglasNotificacionRepository],
})
export class ReglasNotificacionModule {}
