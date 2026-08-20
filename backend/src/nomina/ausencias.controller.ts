import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AusenciasService } from './ausencias.service';
import { CrearAusenciaDto } from './dto/crear-ausencia.dto';
import { CambiarEstadoAusenciaDto } from './dto/cambiar-estado-ausencia.dto';
import { ListarAusenciasQueryDto } from './dto/listar-ausencias-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('nomina')
@RequiereModulo('nomina')
@Controller('nomina/ausencias')
export class AusenciasController {
  constructor(private readonly ausenciasService: AusenciasService) {}

  @Post()
  @Permissions('rrhh.editar')
  crear(@Body() dto: CrearAusenciaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ausenciasService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('rrhh.ver')
  listar(@Query() query: ListarAusenciasQueryDto) {
    return this.ausenciasService.listar(query);
  }

  @Get(':id')
  @Permissions('rrhh.ver')
  buscarPorId(@Param('id') id: string) {
    return this.ausenciasService.buscarPorId(id);
  }

  @Patch(':id/estado')
  @Permissions('rrhh.aprobar')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoAusenciaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ausenciasService.cambiarEstado(id, dto.estado, user.userId);
  }
}
