import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EcommerceController } from './ecommerce.controller';
import { EcommercePedidosController } from './ecommerce-pedidos.controller';
import { SeccionesTiendaController } from './secciones-tienda.controller';
import { EcommerceService } from './ecommerce.service';
import { EcommerceRepository } from './ecommerce.repository';
import { PedidosTiendaRepository } from './pedidos-tienda.repository';
import { SeccionesTiendaRepository } from './secciones-tienda.repository';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { ClientesModule } from '../clientes/clientes.module';
import { VariantesModule } from '../variantes/variantes.module';
import { OfertasModule } from '../ofertas/ofertas.module';

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
  // JwtModule.register({}) vacío — igual criterio que platform-auth/
  // cliente-tienda-auth: el secreto (CLIENTE_TIENDA_JWT_SECRET) se pasa
  // por-llamada en EcommerceService.resolverClienteId, no acá. Se
  // registra local en vez de importar ClienteTiendaAuthModule a
  // propósito: evita acoplar los dos módulos entre sí por un JwtService
  // que de todos modos no comparte estado (ver ese archivo).
  imports: [FacturacionModule, ClientesModule, VariantesModule, OfertasModule, JwtModule.register({})],
  controllers: [EcommerceController, EcommercePedidosController, SeccionesTiendaController],
  providers: [EcommerceService, EcommerceRepository, PedidosTiendaRepository, SeccionesTiendaRepository],
})
export class EcommerceModule {}
