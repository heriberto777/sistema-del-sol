import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AjustesInventarioService } from './ajustes-inventario.service';
import { CrearAjusteInventarioDto } from './dto/crear-ajuste-inventario.dto';
import { ActualizarAjusteInventarioDto } from './dto/actualizar-ajuste-inventario.dto';
import { CambiarEstadoAjusteInventarioDto } from './dto/cambiar-estado-ajuste-inventario.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../../common/types/authenticated-request';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

/** Ítem E-1 — documento Borrador→Confirmado para ajustes de inventario, reusa los permisos ya existentes de `inventario.*`. */
@ApiBearerAuth()
@ApiTags('ajustes-inventario')
@Controller('ajustes-inventario')
export class AjustesInventarioController {
  constructor(private readonly ajustesInventarioService: AjustesInventarioService) {}

  @Post()
  @Permissions('inventario.ajustar')
  crear(@Body() dto: CrearAjusteInventarioDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ajustesInventarioService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('inventario.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.ajustesInventarioService.listar(query);
  }

  @Get(':id')
  @Permissions('inventario.ver')
  buscarPorId(@Param('id') id: string) {
    return this.ajustesInventarioService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('inventario.ajustar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarAjusteInventarioDto) {
    return this.ajustesInventarioService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @Permissions('inventario.ajustar')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoAjusteInventarioDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ajustesInventarioService.cambiarEstado(id, dto, user.tenantId, user.userId);
  }
}
