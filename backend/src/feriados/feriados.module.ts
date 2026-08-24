import { Module } from '@nestjs/common';
import { FeriadosService } from './feriados.service';
import { FeriadosController } from './feriados.controller';
import { FeriadosRepository } from './feriados.repository';

@Module({
  controllers: [FeriadosController],
  providers: [FeriadosService, FeriadosRepository],
  exports: [FeriadosService, FeriadosRepository],
})
export class FeriadosModule {}
