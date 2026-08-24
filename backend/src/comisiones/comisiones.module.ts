import { Module } from '@nestjs/common';
import { ComisionesService } from './comisiones.service';
import { ComisionesRepository } from './comisiones.repository';
import { ComisionesEventosService } from './comisiones-eventos.service';
import { ComisionesController } from './comisiones.controller';

@Module({
  controllers: [ComisionesController],
  providers: [ComisionesService, ComisionesRepository, ComisionesEventosService],
})
export class ComisionesModule {}
