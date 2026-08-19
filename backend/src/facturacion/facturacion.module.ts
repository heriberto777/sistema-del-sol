import { Module } from '@nestjs/common';
import { FacturacionService } from './facturacion.service';
import { FacturacionController } from './facturacion.controller';
import { FacturacionRepository } from './facturacion.repository';
import { InventarioModule } from '../inventario/inventario.module';
import { PagosModule } from '../pagos/pagos.module';
import { ClientesModule } from '../clientes/clientes.module';

@Module({
  imports: [InventarioModule, PagosModule, ClientesModule],
  controllers: [FacturacionController],
  providers: [FacturacionService, FacturacionRepository],
  exports: [FacturacionService],
})
export class FacturacionModule {}
