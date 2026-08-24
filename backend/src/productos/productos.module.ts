import { Module } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';
import { ProductosRepository } from './productos.repository';
import { CategoriasModule } from '../categorias/categorias.module';
import { LeyesFiscalesModule } from '../leyes-fiscales/leyes-fiscales.module';
import { VariantesModule } from '../variantes/variantes.module';
import { PreciosRepository } from '../precios/precios.repository';

// PreciosRepository se provee acá directo (no vía PreciosModule) para que
// ProductosService pueda crear el Precio GENERAL de una fila importada
// (Fase 3e) sin crear un ciclo de módulos: PreciosModule ya importa
// ProductosModule, así que ProductosModule -> PreciosModule sería
// circular. PreciosRepository no depende de nada de Productos, así que
// darle su propia instancia acá es seguro.
@Module({
  imports: [CategoriasModule, LeyesFiscalesModule, VariantesModule],
  controllers: [ProductosController],
  providers: [ProductosService, ProductosRepository, PreciosRepository],
  exports: [ProductosService],
})
export class ProductosModule {}
