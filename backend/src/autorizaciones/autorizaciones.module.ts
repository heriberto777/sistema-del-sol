import { Module } from '@nestjs/common';
import { AutorizacionesService } from './autorizaciones.service';
import { AutorizacionesRepository } from './autorizaciones.repository';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { ConfiguracionesModule } from '../configuraciones/configuraciones.module';

@Module({
  imports: [NotificacionesModule, ConfiguracionesModule],
  providers: [AutorizacionesService, AutorizacionesRepository],
  exports: [AutorizacionesService],
})
export class AutorizacionesModule {}
