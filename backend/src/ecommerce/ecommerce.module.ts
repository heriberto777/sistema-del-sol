import { Module } from '@nestjs/common';
import { EcommerceController } from './ecommerce.controller';
import { EcommercePedidosController } from './ecommerce-pedidos.controller';
import { EcommerceService } from './ecommerce.service';
import { EcommerceRepository } from './ecommerce.repository';
import { PedidosTiendaRepository } from './pedidos-tienda.repository';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { ClientesModule } from '../clientes/clientes.module';

/**
 * Plugin "Tienda Online" (catálogo en `plugins/ecommerce/plugin.json`,
 * activable por Plan/TenantModuloOverride igual que Inmobiliaria — ver
 * MODULOS_BASE). A diferencia de `plugins/inmobiliaria/` (stub nunca
 * importado en AppModule, con imports relativos hacia `backend/src` que
 * probablemente ni compilan — nada de eso está probado), este módulo vive
 * como cualquier feature real del backend: el `tsconfig.json` de
 * `backend/` no incluye `plugins/` en su compilación, así que el código
 * real y funcional tiene que estar acá para que `nest build` lo levante.
 */
@Module({
  imports: [FacturacionModule, ClientesModule],
  controllers: [EcommerceController, EcommercePedidosController],
  providers: [EcommerceService, EcommerceRepository, PedidosTiendaRepository],
})
export class EcommerceModule {}
