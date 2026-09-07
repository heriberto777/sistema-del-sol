import { Module } from '@nestjs/common';
import { ConteoFisicoController } from './conteo-fisico.controller';
import { ConteoFisicoService } from './conteo-fisico.service';
import { ConteoFisicoRepository } from './conteo-fisico.repository';
import { InventarioModule } from '../inventario.module';
import { AjustesInventarioModule } from '../ajustes-inventario/ajustes-inventario.module';
import { CorrelativosModule } from '../../correlativos/correlativos.module';

@Module({
  imports: [InventarioModule, AjustesInventarioModule, CorrelativosModule],
  controllers: [ConteoFisicoController],
  providers: [ConteoFisicoService, ConteoFisicoRepository],
})
export class ConteoFisicoModule {}
