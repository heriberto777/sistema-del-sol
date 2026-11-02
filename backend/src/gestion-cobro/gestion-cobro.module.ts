import { Module } from '@nestjs/common';
import { GestionCobroService } from './gestion-cobro.service';
import { GestionCobroController } from './gestion-cobro.controller';
import { GestionCobroRepository } from './gestion-cobro.repository';

@Module({
  controllers: [GestionCobroController],
  providers: [GestionCobroService, GestionCobroRepository],
})
export class GestionCobroModule {}
