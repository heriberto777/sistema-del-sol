import { Module } from '@nestjs/common';
import { VariantesService } from './variantes.service';
import { VariantesController } from './variantes.controller';
import { VariantesRepository } from './variantes.repository';
import { AtributosModule } from '../atributos/atributos.module';

@Module({
  imports: [AtributosModule],
  controllers: [VariantesController],
  providers: [VariantesService, VariantesRepository],
  exports: [VariantesService, VariantesRepository],
})
export class VariantesModule {}
