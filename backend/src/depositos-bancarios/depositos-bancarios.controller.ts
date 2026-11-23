import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DepositosBancariosService } from './depositos-bancarios.service';
import { CrearDepositoBancarioDto } from './dto/crear-deposito-bancario.dto';
import { EditarDepositoBancarioDto } from './dto/editar-deposito-bancario.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('depositos-bancarios')
@Controller('depositos-bancarios')
export class DepositosBancariosController {
  constructor(private readonly depositosBancariosService: DepositosBancariosService) {}

  @Post()
  @Permissions('contabilidad.editar')
  crear(@Body() dto: CrearDepositoBancarioDto, @CurrentUser() user: JwtPayloadUser) {
    return this.depositosBancariosService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('contabilidad.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.depositosBancariosService.listar(query);
  }

  @Get(':id')
  @Permissions('contabilidad.ver')
  buscarPorId(@Param('id') id: string) {
    return this.depositosBancariosService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('contabilidad.editar')
  editar(@Param('id') id: string, @Body() dto: EditarDepositoBancarioDto, @CurrentUser() user: JwtPayloadUser) {
    return this.depositosBancariosService.editar(id, dto, user.tenantId);
  }

  @Patch(':id/anular')
  @Permissions('contabilidad.anular')
  anular(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.depositosBancariosService.anular(id, user.tenantId);
  }
}
