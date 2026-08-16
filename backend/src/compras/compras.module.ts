import { Module } from '@nestjs/common';
import { ComprasService } from './compras.service';
import { ComprasController } from './compras.controller';
import { ComprasRepository } from './compras.repository';
import { InventarioModule } from '../inventario/inventario.module';
import { PagosModule } from '../pagos/pagos.module';

@Module({
  imports: [InventarioModule, PagosModule],
  controllers: [ComprasController],
  providers: [ComprasService, ComprasRepository],
  exports: [ComprasService],
})
export class ComprasModule {}
