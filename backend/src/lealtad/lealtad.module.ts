import { Module } from '@nestjs/common';
import { LealtadService } from './lealtad.service';
import { LealtadRepository } from './lealtad.repository';
import { LealtadEventosService } from './lealtad-eventos.service';
import { LealtadExpiracionCronService } from './lealtad-expiracion-cron.service';
import { LealtadController } from './lealtad.controller';

@Module({
  controllers: [LealtadController],
  providers: [LealtadService, LealtadRepository, LealtadEventosService, LealtadExpiracionCronService],
  exports: [LealtadService],
})
export class LealtadModule {}
