import { Module } from '@nestjs/common';
import { EmailConfigTenantController } from './email-config-tenant.controller';
import { EmailConfigTenantService } from './email-config-tenant.service';
import { EmailConfigTenantRepository } from './email-config-tenant.repository';

@Module({
  controllers: [EmailConfigTenantController],
  providers: [EmailConfigTenantService, EmailConfigTenantRepository],
})
export class EmailConfigTenantModule {}
