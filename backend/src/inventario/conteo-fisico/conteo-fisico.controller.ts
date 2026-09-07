import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConteoFisicoService } from './conteo-fisico.service';
import { CrearConteoFisicoDto } from './dto/crear-conteo-fisico.dto';
import { CapturarLineaConteoDto } from './dto/capturar-linea-conteo.dto';
import { AplicarConteoDto } from './dto/aplicar-conteo.dto';
import { ListarConteoFisicoQueryDto } from './dto/listar-conteo-fisico-query.dto';
import { ListarLineasConteoQueryDto } from './dto/listar-lineas-conteo-query.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../../common/types/authenticated-request';

/**
 * Conteo Físico vs Teórico — 'inventario.contar' separado de
 * 'inventario.ajustar' a propósito (separación de funciones: contar no
 * es lo mismo que poder mover stock).
 */
@ApiBearerAuth()
@ApiTags('conteo-fisico')
@Controller('inventario/conteos')
export class ConteoFisicoController {
  constructor(private readonly conteoFisicoService: ConteoFisicoService) {}

  @Post()
  @Permissions('inventario.contar')
  crear(@Body() dto: CrearConteoFisicoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.conteoFisicoService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('inventario.ver')
  listar(@Query() query: ListarConteoFisicoQueryDto) {
    return this.conteoFisicoService.listar(query);
  }

  @Get(':id')
  @Permissions('inventario.ver')
  buscarResumen(@Param('id') id: string) {
    return this.conteoFisicoService.buscarResumen(id);
  }

  @Get(':id/lineas')
  @Permissions('inventario.ver')
  listarLineas(@Param('id') id: string, @Query() query: ListarLineasConteoQueryDto) {
    return this.conteoFisicoService.listarLineas(id, query);
  }

  @Patch(':id/lineas/:lineaId')
  @Permissions('inventario.contar')
  capturarLinea(
    @Param('id') id: string,
    @Param('lineaId') lineaId: string,
    @Body() dto: CapturarLineaConteoDto,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.conteoFisicoService.capturarLinea(id, lineaId, dto.cantidadContada, user.userId);
  }

  @Post(':id/aplicar')
  @Permissions('inventario.ajustar')
  aplicar(@Param('id') id: string, @Body() dto: AplicarConteoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.conteoFisicoService.aplicar(id, user.tenantId, user.userId, dto.pin);
  }

  @Post(':id/cancelar')
  @Permissions('inventario.ajustar')
  cancelar(@Param('id') id: string) {
    return this.conteoFisicoService.cancelar(id);
  }
}
