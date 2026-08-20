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
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule: FacturacionService llama a authService.verificarPin() en
  // anular() (Fase 9). El acceso por sucursal se valida vía
  // InventarioService.validarAccesoBodega (ya importado abajo), sin
  // necesitar SucursalesModule acá directamente.
  imports: [InventarioModule, PagosModule, ClientesModule, VariantesModule, OfertasModule, BonosModule, AuthModule],
  controllers: [FacturacionController],
  providers: [FacturacionService, FacturacionRepository],
  exports: [FacturacionService],
})
export class FacturacionModule {}
