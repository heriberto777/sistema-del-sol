import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformRolesService } from './platform-roles.service';
import { CrearPlatformRoleDto } from './dto/crear-platform-role.dto';
import { ActualizarPlatformRoleDto } from './dto/actualizar-platform-role.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';

@ApiBearerAuth()
@ApiTags('platform-roles')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/roles')
export class PlatformRolesController {
  constructor(private readonly platformRolesService: PlatformRolesService) {}

  @Get('permisos')
  @PlatformPermissions('platform.roles.ver')
  listarPermisos() {
    return this.platformRolesService.listarPermisos();
  }

  @Get()
  @PlatformPermissions('platform.roles.ver')
  listar() {
    return this.platformRolesService.listar();
  }

  @Get(':id')
  @PlatformPermissions('platform.roles.ver')
  buscarPorId(@Param('id') id: string) {
    return this.platformRolesService.buscarPorId(id);
  }

  @Post()
  @PlatformPermissions('platform.roles.gestionar')
  crear(@Body() dto: CrearPlatformRoleDto) {
    return this.platformRolesService.crear(dto);
  }

  @Patch(':id')
  @PlatformPermissions('platform.roles.gestionar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarPlatformRoleDto) {
    return this.platformRolesService.actualizar(id, dto);
  }
}
