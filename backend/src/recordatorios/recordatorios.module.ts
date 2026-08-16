import { Module } from '@nestjs/common';
import { RecordatoriosService } from './recordatorios.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [NotificacionesModule],
  providers: [RecordatoriosService],
})
export class RecordatoriosModule {}
