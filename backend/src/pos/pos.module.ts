import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { PosRepository } from './pos.repository';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { ConfiguracionesModule } from '../configuraciones/configuraciones.module';
import { FormasPagoModule } from '../formas-pago/formas-pago.module';
import { NominaModule } from '../nomina/nomina.module';

@Module({
  imports: [FacturacionModule, ConfiguracionesModule, FormasPagoModule, NominaModule],
  controllers: [PosController],
  providers: [PosService, PosRepository],
})
export class PosModule {}
