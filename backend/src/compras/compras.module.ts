import { Module } from '@nestjs/common';
import { ComprasService } from './compras.service';
import { ComprasController } from './compras.controller';
import { ComprasRepository } from './compras.repository';
import { InventarioModule } from '../inventario/inventario.module';
import { PagosModule } from '../pagos/pagos.module';
import { VariantesModule } from '../variantes/variantes.module';
import { CorrelativosModule } from '../correlativos/correlativos.module';
import { ProductosModule } from '../productos/productos.module';

@Module({
  imports: [InventarioModule, PagosModule, VariantesModule, CorrelativosModule, ProductosModule],
  controllers: [ComprasController],
  providers: [ComprasService, ComprasRepository],
  exports: [ComprasService],
})
export class ComprasModule {}
