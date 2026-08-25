import { Module } from '@nestjs/common';
import { PasarelaCobroConfigController } from './pasarela-cobro-config.controller';
import { PasarelaCobroConfigService } from './pasarela-cobro-config.service';
import { PasarelaCobroConfigRepository } from './pasarela-cobro-config.repository';
import { CobrosPublicosController } from './cobros-publicos.controller';
import { CobrosPublicosService } from './cobros-publicos.service';
import { SesionesCobroRepository } from './sesiones-cobro.repository';
import { AzulAdapter } from './adapters/azul.adapter';
import { FacturacionModule } from '../facturacion/facturacion.module';

@Module({
  imports: [FacturacionModule],
  controllers: [PasarelaCobroConfigController, CobrosPublicosController],
  providers: [PasarelaCobroConfigService, PasarelaCobroConfigRepository, CobrosPublicosService, SesionesCobroRepository, AzulAdapter],
})
export class PasarelaCobroModule {}
