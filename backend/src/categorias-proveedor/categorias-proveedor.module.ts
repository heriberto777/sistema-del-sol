import { Module } from '@nestjs/common';
import { CategoriasProveedorService } from './categorias-proveedor.service';
import { CategoriasProveedorController } from './categorias-proveedor.controller';
import { CategoriasProveedorRepository } from './categorias-proveedor.repository';

@Module({
  controllers: [CategoriasProveedorController],
  providers: [CategoriasProveedorService, CategoriasProveedorRepository],
  exports: [CategoriasProveedorService, CategoriasProveedorRepository],
})
export class CategoriasProveedorModule {}
