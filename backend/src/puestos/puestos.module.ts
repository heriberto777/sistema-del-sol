import { Module } from '@nestjs/common';
import { PuestosService } from './puestos.service';
import { PuestosController } from './puestos.controller';
import { PuestosRepository } from './puestos.repository';

@Module({
  controllers: [PuestosController],
  providers: [PuestosService, PuestosRepository],
  exports: [PuestosService, PuestosRepository],
})
export class PuestosModule {}
