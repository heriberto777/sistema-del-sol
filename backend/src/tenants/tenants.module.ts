import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantsRepository } from './tenants.repository';
import { TenantDominiosService } from './tenant-dominios.service';
import { TenantDominiosRepository } from './tenant-dominios.repository';
import { TenantDominiosPublicaController } from './tenant-dominios-publica.controller';
import { PlatformAuthModule } from '../platform-auth/platform-auth.module';
import { PlataformaConfigModule } from '../plataforma-config/plataforma-config.module';

@Module({
  imports: [PlatformAuthModule, PlataformaConfigModule],
  controllers: [TenantsController, TenantDominiosPublicaController],
  providers: [TenantsService, TenantsRepository, TenantDominiosService, TenantDominiosRepository],
  // Fase 4 (auto-suspensión) — FacturacionPlataformaModule necesita marcar
  // Tenant.estado = SUSPENDIDO desde su cron.
  exports: [TenantsService],
})
export class TenantsModule {}
