import { Module } from '@nestjs/common';
import { PlatformAdminsController } from './platform-admins.controller';
import { PlatformAdminsService } from './platform-admins.service';
import { PlatformAdminsRepository } from './platform-admins.repository';
import { PlatformRolesController } from './platform-roles.controller';
import { PlatformRolesService } from './platform-roles.service';
import { PlatformRolesRepository } from './platform-roles.repository';

@Module({
  controllers: [PlatformAdminsController, PlatformRolesController],
  providers: [PlatformAdminsService, PlatformAdminsRepository, PlatformRolesService, PlatformRolesRepository],
})
export class PlatformAdminsModule {}
