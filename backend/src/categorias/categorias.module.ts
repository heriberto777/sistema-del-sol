import { Module } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CategoriasController } from './categorias.controller';
import { CategoriasRepository } from './categorias.repository';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';

@Module({
  imports: [ContabilidadModule],
  controllers: [CategoriasController],
  providers: [CategoriasService, CategoriasRepository],
  exports: [CategoriasService, CategoriasRepository],
})
export class CategoriasModule {}
