import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransferenciasInventarioService } from './transferencias-inventario.service';
import { CrearTransferenciaInventarioDto } from './dto/crear-transferencia-inventario.dto';
import { ActualizarTransferenciaInventarioDto } from './dto/actualizar-transferencia-inventario.dto';
import { CambiarEstadoTransferenciaInventarioDto } from './dto/cambiar-estado-transferencia-inventario.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../../common/types/authenticated-request';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

/** Ítem E-1 — documento Borrador→Confirmado para transferencias de inventario, reusa los permisos ya existentes de `inventario.*`. */
@ApiBearerAuth()
@ApiTags('transferencias-inventario')
@Controller('transferencias-inventario')
export class TransferenciasInventarioController {
  constructor(private readonly transferenciasInventarioService: TransferenciasInventarioService) {}

  @Post()
  @Permissions('inventario.transferir')
  crear(@Body() dto: CrearTransferenciaInventarioDto, @CurrentUser() user: JwtPayloadUser) {
    return this.transferenciasInventarioService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('inventario.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.transferenciasInventarioService.listar(query);
  }

  @Get(':id')
  @Permissions('inventario.ver')
  buscarPorId(@Param('id') id: string) {
    return this.transferenciasInventarioService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('inventario.transferir')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarTransferenciaInventarioDto) {
    return this.transferenciasInventarioService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @Permissions('inventario.transferir')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoTransferenciaInventarioDto, @CurrentUser() user: JwtPayloadUser) {
    return this.transferenciasInventarioService.cambiarEstado(id, dto, user.tenantId, user.userId);
  }
}
