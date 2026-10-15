import { Module } from '@nestjs/common';
import { TravelConfigController } from './travel-config.controller';
import { TravelConfigService } from './travel-config.service';
import { TravelConfigRepository } from './travel-config.repository';

@Module({
  controllers: [TravelConfigController],
  providers: [TravelConfigService, TravelConfigRepository],
  exports: [TravelConfigService],
})
export class TravelConfigModule {}
