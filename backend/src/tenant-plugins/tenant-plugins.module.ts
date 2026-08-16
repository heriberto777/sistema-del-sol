import { Module } from '@nestjs/common';
import { TenantPluginsService } from './tenant-plugins.service';
import { TenantPluginsController } from './tenant-plugins.controller';
import { TenantPluginsRepository } from './tenant-plugins.repository';

@Module({
  controllers: [TenantPluginsController],
  providers: [TenantPluginsService, TenantPluginsRepository],
})
export class TenantPluginsModule {}
