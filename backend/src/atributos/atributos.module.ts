import { Module } from '@nestjs/common';
import { AtributosService } from './atributos.service';
import { AtributosController } from './atributos.controller';
import { AtributosRepository } from './atributos.repository';

@Module({
  controllers: [AtributosController],
  providers: [AtributosService, AtributosRepository],
  exports: [AtributosService, AtributosRepository],
})
export class AtributosModule {}
