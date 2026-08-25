import { Module } from '@nestjs/common';
import { CajasService } from './cajas.service';
import { CajasRepository } from './cajas.repository';
import { CajasController } from './cajas.controller';

@Module({
  controllers: [CajasController],
  providers: [CajasService, CajasRepository],
  exports: [CajasService],
})
export class CajasModule {}
