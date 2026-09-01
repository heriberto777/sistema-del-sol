import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformDashboardService } from './platform-dashboard.service';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';

/** Ítem "dashboard de plataforma" — resumen de tenants/cartera/planes para la pantalla de inicio. */
@ApiBearerAuth()
@ApiTags('platform-dashboard')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/dashboard')
export class PlatformDashboardController {
  constructor(private readonly platformDashboardService: PlatformDashboardService) {}

  @Get()
  @PlatformPermissions('platform.tenants.ver')
  resumen() {
    return this.platformDashboardService.resumen();
  }
}
