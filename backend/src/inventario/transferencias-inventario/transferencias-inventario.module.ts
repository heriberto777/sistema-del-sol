import { Module } from '@nestjs/common';
import { TransferenciasInventarioController } from './transferencias-inventario.controller';
import { TransferenciasInventarioService } from './transferencias-inventario.service';
import { TransferenciasInventarioRepository } from './transferencias-inventario.repository';
import { InventarioModule } from '../inventario.module';
import { VariantesModule } from '../../variantes/variantes.module';
import { CorrelativosModule } from '../../correlativos/correlativos.module';

@Module({
  imports: [InventarioModule, VariantesModule, CorrelativosModule],
  controllers: [TransferenciasInventarioController],
  providers: [TransferenciasInventarioService, TransferenciasInventarioRepository],
})
export class TransferenciasInventarioModule {}
