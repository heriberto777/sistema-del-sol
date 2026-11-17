import { Module } from '@nestjs/common';
import { ReportesTenantService } from './reportes-tenant.service';
import { ReportesTenantController } from './reportes-tenant.controller';
import { ReportesTenantRepository } from './reportes-tenant.repository';
import { PlatformReportesTenantService } from './platform-reportes-tenant.service';
import { PlatformReportesTenantController } from './platform-reportes-tenant.controller';
import { PlatformReportesTenantRepository } from './platform-reportes-tenant.repository';

/**
 * Un solo módulo para las dos caras de "Reportar un problema" (tenant →
 * plataforma) — comparten la misma tabla `ReporteTenant`, cada lado con
 * su propio controller/service/repository (el lado tenant usa
 * `TenantPrismaService`, auto-scoped; el lado plataforma usa
 * `PrismaService` global, cruza todos los tenants — ver el comentario de
 * cada repository).
 */
@Module({
  controllers: [ReportesTenantController, PlatformReportesTenantController],
  providers: [ReportesTenantService, ReportesTenantRepository, PlatformReportesTenantService, PlatformReportesTenantRepository],
})
export class ReportesTenantModule {}
