import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificacionesService } from './notificaciones.service';
import { CrearPlantillaDto } from './dto/crear-plantilla.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('notificaciones')
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  @Permissions('notificaciones.ver')
  listar(@CurrentUser() user: JwtPayloadUser, @Query() query: ListadoQueryDto) {
    return this.notificacionesService.listar(user.tenantId, query);
  }

  @Get('plantillas')
  @Permissions('admin.configuracion')
  listarPlantillas(@CurrentUser() user: JwtPayloadUser) {
    return this.notificacionesService.listarPlantillas(user.tenantId);
  }

  @Post('plantillas')
  @Permissions('admin.configuracion')
  guardarPlantilla(@Body() dto: CrearPlantillaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.notificacionesService.guardarPlantilla(user.tenantId, dto);
  }
}
