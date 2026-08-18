import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformAdminsService } from './platform-admins.service';
import { CrearPlatformAdminDto } from './dto/crear-platform-admin.dto';
import { ActualizarPlatformAdminDto } from './dto/actualizar-platform-admin.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';
import { CurrentPlatformAdmin } from '../platform-auth/current-platform-admin.decorator';
import { PlatformAdminPayload } from '../platform-auth/platform-authenticated-request';

@ApiBearerAuth()
@ApiTags('platform-admins')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/admins')
export class PlatformAdminsController {
  constructor(private readonly platformAdminsService: PlatformAdminsService) {}

  @Get()
  @PlatformPermissions('platform.admins.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.platformAdminsService.listar(query);
  }

  @Post()
  @PlatformPermissions('platform.admins.gestionar')
  crear(@Body() dto: CrearPlatformAdminDto) {
    return this.platformAdminsService.crear(dto);
  }

  @Patch(':id')
  @PlatformPermissions('platform.admins.gestionar')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarPlatformAdminDto,
    @CurrentPlatformAdmin() admin: PlatformAdminPayload,
  ) {
    return this.platformAdminsService.actualizar(id, dto, admin.adminId);
  }
}
