import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantModulosService } from './tenant-modulos.service';
import { ActualizarModuloTenantDto } from './dto/actualizar-modulo-tenant.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';

@ApiBearerAuth()
@ApiTags('platform-tenant-modulos')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/tenants/:tenantId/modulos')
export class TenantModulosController {
  constructor(private readonly tenantModulosService: TenantModulosService) {}

  @Get()
  @PlatformPermissions('platform.tenants.ver')
  listar(@Param('tenantId') tenantId: string) {
    return this.tenantModulosService.listar(tenantId);
  }

  @Patch(':clave')
  @PlatformPermissions('platform.tenants.gestionar')
  actualizar(@Param('tenantId') tenantId: string, @Param('clave') clave: string, @Body() dto: ActualizarModuloTenantDto) {
    return this.tenantModulosService.actualizarOverride(tenantId, clave, dto.activo);
  }
}
