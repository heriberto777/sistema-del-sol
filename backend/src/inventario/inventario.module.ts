import { Module } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { InventarioController } from './inventario.controller';
import { InventarioRepository } from './inventario.repository';
import { ProductosModule } from '../productos/productos.module';
import { VariantesModule } from '../variantes/variantes.module';

@Module({
  imports: [ProductosModule, VariantesModule],
  controllers: [InventarioController],
  providers: [InventarioService, InventarioRepository],
  exports: [InventarioService],
})
export class InventarioModule {}
