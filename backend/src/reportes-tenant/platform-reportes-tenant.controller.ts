import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformReportesTenantService } from './platform-reportes-tenant.service';
import { ListarReportesTenantQueryDto } from './dto/listar-reportes-tenant-query.dto';
import { CrearMensajeReporteTenantDto } from './dto/crear-mensaje-reporte-tenant.dto';
import { CambiarEstadoReporteTenantDto } from './dto/cambiar-estado-reporte-tenant.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';
import { CurrentPlatformAdmin } from '../platform-auth/current-platform-admin.decorator';
import { PlatformAdminPayload } from '../platform-auth/platform-authenticated-request';

@ApiBearerAuth()
@ApiTags('platform-reportes-tenant')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/reportes-tenant')
export class PlatformReportesTenantController {
  constructor(private readonly platformReportesTenantService: PlatformReportesTenantService) {}

  @Get()
  @PlatformPermissions('platform.soporte.gestionar')
  listar(@Query() query: ListarReportesTenantQueryDto) {
    return this.platformReportesTenantService.listar(query);
  }

  /** Badge del sidebar de plataforma — contador de reportes en estado NUEVO. */
  @Get('contador-nuevos')
  @PlatformPermissions('platform.soporte.gestionar')
  contarNuevos() {
    return this.platformReportesTenantService.contarNuevos();
  }

  @Get(':id')
  @PlatformPermissions('platform.soporte.gestionar')
  buscarPorId(@Param('id') id: string) {
    return this.platformReportesTenantService.buscarPorId(id);
  }

  @Get(':id/mensajes')
  @PlatformPermissions('platform.soporte.gestionar')
  listarMensajes(@Param('id') id: string) {
    return this.platformReportesTenantService.listarMensajes(id);
  }

  @Post(':id/mensajes')
  @PlatformPermissions('platform.soporte.gestionar')
  agregarMensaje(@Param('id') id: string, @Body() dto: CrearMensajeReporteTenantDto, @CurrentPlatformAdmin() admin: PlatformAdminPayload) {
    return this.platformReportesTenantService.agregarMensaje(id, dto, admin.adminId);
  }

  @Patch(':id/estado')
  @PlatformPermissions('platform.soporte.gestionar')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoReporteTenantDto) {
    return this.platformReportesTenantService.cambiarEstado(id, dto);
  }
}
