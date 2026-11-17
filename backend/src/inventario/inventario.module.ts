import { Module } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { InventarioController } from './inventario.controller';
import { InventarioRepository } from './inventario.repository';
import { LotesCronService } from './lotes-cron.service';
import { ProductosModule } from '../productos/productos.module';
import { VariantesModule } from '../variantes/variantes.module';
import { SucursalesModule } from '../sucursales/sucursales.module';
import { AuthModule } from '../auth/auth.module';
import { ConfiguracionesModule } from '../configuraciones/configuraciones.module';

@Module({
  imports: [ProductosModule, VariantesModule, SucursalesModule, AuthModule, ConfiguracionesModule],
  controllers: [InventarioController],
  providers: [InventarioService, InventarioRepository, LotesCronService],
  exports: [InventarioService],
})
export class InventarioModule {}
