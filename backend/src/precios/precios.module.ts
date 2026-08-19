import { Module } from '@nestjs/common';
import { PreciosService } from './precios.service';
import { PreciosController } from './precios.controller';
import { PreciosRepository } from './precios.repository';
import { ProductosModule } from '../productos/productos.module';
import { VariantesModule } from '../variantes/variantes.module';

@Module({
  imports: [ProductosModule, VariantesModule],
  controllers: [PreciosController],
  providers: [PreciosService, PreciosRepository],
  exports: [PreciosService],
})
export class PreciosModule {}
