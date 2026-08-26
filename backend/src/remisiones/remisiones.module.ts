import { Module } from '@nestjs/common';
import { RemisionesService } from './remisiones.service';
import { RemisionesController } from './remisiones.controller';
import { RemisionesRepository } from './remisiones.repository';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { VariantesModule } from '../variantes/variantes.module';
import { InventarioModule } from '../inventario/inventario.module';
import { CorrelativosModule } from '../correlativos/correlativos.module';

@Module({
  imports: [FacturacionModule, VariantesModule, InventarioModule, CorrelativosModule],
  controllers: [RemisionesController],
  providers: [RemisionesService, RemisionesRepository],
})
export class RemisionesModule {}
