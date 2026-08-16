import { Module } from '@nestjs/common';
import { PreciosService } from './precios.service';
import { PreciosController } from './precios.controller';
import { PreciosRepository } from './precios.repository';
import { ProductosModule } from '../productos/productos.module';

@Module({
  imports: [ProductosModule],
  controllers: [PreciosController],
  providers: [PreciosService, PreciosRepository],
  exports: [PreciosService],
})
export class PreciosModule {}
