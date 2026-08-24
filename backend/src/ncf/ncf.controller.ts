import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NcfService } from './ncf.service';
import { CrearNcfDto } from './dto/crear-ncf.dto';
import { ActualizarNcfDto } from './dto/actualizar-ncf.dto';
import { ActualizarModalidadFacturacionDto } from './dto/actualizar-modalidad-facturacion.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('admin-ncf')
@Controller('admin/ncf')
export class NcfController {
  constructor(private readonly ncfService: NcfService) {}

  @Get()
  @Permissions('admin.configuracion')
  listar() {
    return this.ncfService.listar();
  }

  // Rutas literales ('modalidad') declaradas ANTES de la ruta comodín
  // (':id' más abajo) — Nest matchea en orden de declaración, así que si
  // ':id' fuera primero, "modalidad" se interpretaría como un id en vez
  // de llegar acá.
  @Get('modalidad')
  @Permissions('admin.configuracion')
  obtenerModalidad(@CurrentUser() user: JwtPayloadUser) {
    return this.ncfService.obtenerModalidad(user.tenantId);
  }

  @Patch('modalidad')
  @Permissions('admin.configuracion')
  actualizarModalidad(@Body() dto: ActualizarModalidadFacturacionDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ncfService.actualizarModalidad(user.tenantId, dto.modalidad);
  }

  @Post()
  @Permissions('admin.configuracion')
  crear(@Body() dto: CrearNcfDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ncfService.crear(dto, user.tenantId);
  }

  @Patch(':id')
  @Permissions('admin.configuracion')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarNcfDto) {
    return this.ncfService.actualizar(id, dto);
  }
}
