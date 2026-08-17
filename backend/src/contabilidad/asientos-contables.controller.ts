import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AsientosContablesService } from './asientos-contables.service';
import { CrearAsientoDto } from './dto/crear-asiento.dto';
import { CrearGastoDto } from './dto/crear-gasto.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('contabilidad')
@Controller('contabilidad/asientos')
export class AsientosContablesController {
  constructor(private readonly asientosContablesService: AsientosContablesService) {}

  @Post()
  @Permissions('contabilidad.editar')
  crear(@Body() dto: CrearAsientoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.asientosContablesService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('contabilidad.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.asientosContablesService.listar(query);
  }

  @Get(':id')
  @Permissions('contabilidad.ver')
  buscarPorId(@Param('id') id: string) {
    return this.asientosContablesService.buscarPorId(id);
  }

  @Post('gastos')
  @Permissions('contabilidad.editar')
  crearGasto(@Body() dto: CrearGastoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.asientosContablesService.crearGasto(dto, user.tenantId);
  }

  @Post(':id/anular')
  @Permissions('contabilidad.anular')
  anular(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.asientosContablesService.anular(id, user.tenantId);
  }
}
