import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReglasNotificacionService } from './reglas-notificacion.service';
import { CrearReglaNotificacionDto } from './dto/crear-regla-notificacion.dto';
import { ActualizarReglaNotificacionDto } from './dto/actualizar-regla-notificacion.dto';
import { Public } from '../../common/decorators/public.decorator';
import { PlatformPermissions } from '../../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

/** Fase 4 — reglas de notificación de vencimiento configurables, mismo criterio de guards que PlataformaConfigController. */
@ApiBearerAuth()
@ApiTags('platform-reglas-notificacion')
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/configuracion/reglas-notificacion')
export class ReglasNotificacionController {
  constructor(private readonly reglasNotificacionService: ReglasNotificacionService) {}

  @Post()
  @PlatformPermissions('platform.configuracion.gestionar')
  crear(@Body() dto: CrearReglaNotificacionDto) {
    return this.reglasNotificacionService.crear(dto);
  }

  @Get()
  @PlatformPermissions('platform.configuracion.ver')
  listar() {
    return this.reglasNotificacionService.listar();
  }

  @Patch(':id')
  @PlatformPermissions('platform.configuracion.gestionar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarReglaNotificacionDto) {
    return this.reglasNotificacionService.actualizarActiva(id, dto.activa);
  }

  @Delete(':id')
  @PlatformPermissions('platform.configuracion.gestionar')
  eliminar(@Param('id') id: string) {
    return this.reglasNotificacionService.eliminar(id);
  }
}
