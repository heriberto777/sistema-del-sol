import { Module } from '@nestjs/common';
import { PasarelaCobroConfigController } from './pasarela-cobro-config.controller';
import { PasarelaCobroConfigService } from './pasarela-cobro-config.service';
import { PasarelaCobroConfigRepository } from './pasarela-cobro-config.repository';

@Module({
  controllers: [PasarelaCobroConfigController],
  providers: [PasarelaCobroConfigService, PasarelaCobroConfigRepository],
})
export class PasarelaCobroModule {}
