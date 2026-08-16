import { Module } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { InventarioController } from './inventario.controller';
import { InventarioRepository } from './inventario.repository';
import { ProductosModule } from '../productos/productos.module';

@Module({
  imports: [ProductosModule],
  controllers: [InventarioController],
  providers: [InventarioService, InventarioRepository],
  exports: [InventarioService],
})
export class InventarioModule {}
