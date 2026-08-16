import { Module } from '@nestjs/common';
import { BancosService } from './bancos.service';
import { BancosController } from './bancos.controller';
import { BancosRepository } from './bancos.repository';

@Module({
  controllers: [BancosController],
  providers: [BancosService, BancosRepository],
  exports: [BancosService],
})
export class BancosModule {}
