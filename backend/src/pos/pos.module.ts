import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { PosRepository } from './pos.repository';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { ConfiguracionesModule } from '../configuraciones/configuraciones.module';

@Module({
  imports: [FacturacionModule, ConfiguracionesModule],
  controllers: [PosController],
  providers: [PosService, PosRepository],
})
export class PosModule {}
