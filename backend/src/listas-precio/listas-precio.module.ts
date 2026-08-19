import { Module } from '@nestjs/common';
import { ListasPrecioService } from './listas-precio.service';
import { ListasPrecioController } from './listas-precio.controller';
import { ListasPrecioRepository } from './listas-precio.repository';

@Module({
  controllers: [ListasPrecioController],
  providers: [ListasPrecioService, ListasPrecioRepository],
  exports: [ListasPrecioService, ListasPrecioRepository],
})
export class ListasPrecioModule {}
