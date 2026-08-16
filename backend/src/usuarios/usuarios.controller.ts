import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearRolDto } from './dto/crear-rol.dto';
import { ActualizarRolDto } from './dto/actualizar-rol.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('admin-usuarios')
@Controller('admin')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('roles')
  @Permissions('admin.usuarios')
  listarRoles() {
    return this.usuariosService.listarRoles();
  }

  @Get('permisos')
  @Permissions('admin.usuarios')
  listarPermisos() {
    return this.usuariosService.listarPermisos();
  }

  @Post('roles')
  @Permissions('admin.usuarios')
  crearRol(@Body() dto: CrearRolDto, @CurrentUser() user: JwtPayloadUser) {
    return this.usuariosService.crearRol(dto, user.tenantId);
  }

  @Get('roles/:id')
  @Permissions('admin.usuarios')
  buscarRolPorId(@Param('id') id: string) {
    return this.usuariosService.buscarRolPorId(id);
  }

  @Patch('roles/:id')
  @Permissions('admin.usuarios')
  actualizarRol(@Param('id') id: string, @Body() dto: ActualizarRolDto) {
    return this.usuariosService.actualizarRol(id, dto);
  }

  @Delete('roles/:id')
  @Permissions('admin.usuarios')
  eliminarRol(@Param('id') id: string) {
    return this.usuariosService.eliminarRol(id);
  }

  @Post('usuarios')
  @Permissions('admin.usuarios')
  crear(@Body() dto: CrearUsuarioDto, @CurrentUser() user: JwtPayloadUser) {
    return this.usuariosService.crear(dto, user.tenantId);
  }

  @Get('usuarios')
  @Permissions('admin.usuarios')
  listar(@Query() query: ListadoQueryDto) {
    return this.usuariosService.listar(query);
  }

  @Get('usuarios/:id')
  @Permissions('admin.usuarios')
  buscarPorId(@Param('id') id: string) {
    return this.usuariosService.buscarPorId(id);
  }

  @Patch('usuarios/:id')
  @Permissions('admin.usuarios')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarUsuarioDto) {
    return this.usuariosService.actualizar(id, dto);
  }
}
