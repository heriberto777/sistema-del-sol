import { Module } from '@nestjs/common';
import { CategoriasIncentivoController } from './categorias-incentivo.controller';
import { CategoriasIncentivoService } from './categorias-incentivo.service';
import { CategoriasIncentivoRepository } from './categorias-incentivo.repository';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { IaModule } from '../ia/ia.module';

@Module({
  imports: [NotificacionesModule, IaModule],
  controllers: [CategoriasIncentivoController],
  providers: [CategoriasIncentivoService, CategoriasIncentivoRepository],
})
export class CategoriasIncentivoModule {}
