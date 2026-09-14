import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TravelReconciliacionService } from './travel-reconciliacion.service';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';

@ApiBearerAuth()
@ApiTags('platform-travel')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/travel/reconciliacion')
export class TravelReconciliacionController {
  constructor(private readonly service: TravelReconciliacionService) {}

  @Get()
  @PlatformPermissions('platform.travel.reconciliar')
  reconciliar() {
    return this.service.reconciliar();
  }
}
