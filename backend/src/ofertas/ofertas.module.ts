import { Module } from '@nestjs/common';
import { OfertasService } from './ofertas.service';
import { OfertasController } from './ofertas.controller';
import { OfertasRepository } from './ofertas.repository';

@Module({
  controllers: [OfertasController],
  providers: [OfertasService, OfertasRepository],
  exports: [OfertasService],
})
export class OfertasModule {}
