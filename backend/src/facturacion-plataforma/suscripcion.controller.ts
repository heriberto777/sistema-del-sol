import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SuscripcionesService } from './suscripciones.service';
import { ActualizarSuscripcionDto } from './dto/actualizar-suscripcion.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';

@ApiBearerAuth()
@ApiTags('platform-suscripcion')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/tenants/:tenantId/suscripcion')
export class SuscripcionController {
  constructor(private readonly suscripcionesService: SuscripcionesService) {}

  @Get()
  @PlatformPermissions('platform.facturacion.ver')
  buscar(@Param('tenantId') tenantId: string) {
    return this.suscripcionesService.buscarPorTenant(tenantId);
  }

  @Patch()
  @PlatformPermissions('platform.facturacion.gestionar')
  actualizar(@Param('tenantId') tenantId: string, @Body() dto: ActualizarSuscripcionDto) {
    return this.suscripcionesService.actualizar(tenantId, dto);
  }

  @Post('generar-factura')
  @PlatformPermissions('platform.facturacion.gestionar')
  generarFactura(@Param('tenantId') tenantId: string) {
    return this.suscripcionesService.generarFacturaAhora(tenantId);
  }
}
