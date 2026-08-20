import { Module } from '@nestjs/common';
import { FacturacionService } from './facturacion.service';
import { FacturacionController } from './facturacion.controller';
import { FacturacionRepository } from './facturacion.repository';
import { InventarioModule } from '../inventario/inventario.module';
import { PagosModule } from '../pagos/pagos.module';
import { ClientesModule } from '../clientes/clientes.module';
import { VariantesModule } from '../variantes/variantes.module';
import { OfertasModule } from '../ofertas/ofertas.module';
import { BonosModule } from '../bonos/bonos.module';

@Module({
  imports: [InventarioModule, PagosModule, ClientesModule, VariantesModule, OfertasModule, BonosModule],
  controllers: [FacturacionController],
  providers: [FacturacionService, FacturacionRepository],
  exports: [FacturacionService],
})
export class FacturacionModule {}
