import { Module } from '@nestjs/common';
import { DepositosBancariosService } from './depositos-bancarios.service';
import { DepositosBancariosController } from './depositos-bancarios.controller';
import { DepositosBancariosRepository } from './depositos-bancarios.repository';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';
import { CorrelativosModule } from '../correlativos/correlativos.module';
import { BancosModule } from '../bancos/bancos.module';

@Module({
  imports: [ContabilidadModule, CorrelativosModule, BancosModule],
  controllers: [DepositosBancariosController],
  providers: [DepositosBancariosService, DepositosBancariosRepository],
})
export class DepositosBancariosModule {}
