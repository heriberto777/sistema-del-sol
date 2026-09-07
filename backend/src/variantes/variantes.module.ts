import { Module } from '@nestjs/common';
import { VariantesService } from './variantes.service';
import { VariantesController, VariantesBusquedaController } from './variantes.controller';
import { VariantesRepository } from './variantes.repository';
import { AtributosModule } from '../atributos/atributos.module';
import { CorrelativosModule } from '../correlativos/correlativos.module';

@Module({
  imports: [AtributosModule, CorrelativosModule],
  controllers: [VariantesController, VariantesBusquedaController],
  providers: [VariantesService, VariantesRepository],
  exports: [VariantesService, VariantesRepository],
})
export class VariantesModule {}
