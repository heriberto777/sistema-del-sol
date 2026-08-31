import { Module } from '@nestjs/common';
import { AjustesInventarioController } from './ajustes-inventario.controller';
import { AjustesInventarioService } from './ajustes-inventario.service';
import { AjustesInventarioRepository } from './ajustes-inventario.repository';
import { InventarioModule } from '../inventario.module';
import { VariantesModule } from '../../variantes/variantes.module';
import { AuthModule } from '../../auth/auth.module';
import { CorrelativosModule } from '../../correlativos/correlativos.module';

@Module({
  imports: [InventarioModule, VariantesModule, AuthModule, CorrelativosModule],
  controllers: [AjustesInventarioController],
  providers: [AjustesInventarioService, AjustesInventarioRepository],
})
export class AjustesInventarioModule {}
