import { Module } from '@nestjs/common';
import { RemisionesService } from './remisiones.service';
import { RemisionesController } from './remisiones.controller';
import { RemisionesRepository } from './remisiones.repository';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { VariantesModule } from '../variantes/variantes.module';

@Module({
  imports: [FacturacionModule, VariantesModule],
  controllers: [RemisionesController],
  providers: [RemisionesService, RemisionesRepository],
})
export class RemisionesModule {}
