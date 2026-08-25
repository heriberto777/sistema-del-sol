import { Module } from '@nestjs/common';
import { CorrelativosService } from './correlativos.service';
import { CorrelativosController } from './correlativos.controller';
import { CorrelativosRepository } from './correlativos.repository';

@Module({
  controllers: [CorrelativosController],
  providers: [CorrelativosService, CorrelativosRepository],
  exports: [CorrelativosService, CorrelativosRepository],
})
export class CorrelativosModule {}
