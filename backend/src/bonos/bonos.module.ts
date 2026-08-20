import { Module } from '@nestjs/common';
import { BonosService } from './bonos.service';
import { BonosController } from './bonos.controller';
import { BonosRepository } from './bonos.repository';
import { BonosCronService } from './bonos-cron.service';

@Module({
  controllers: [BonosController],
  providers: [BonosService, BonosRepository, BonosCronService],
  exports: [BonosService],
})
export class BonosModule {}
