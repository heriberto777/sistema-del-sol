import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GastosMenoresService } from './gastos-menores.service';
import { CrearGastoMenorDto } from './dto/crear-gasto-menor.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('gastos-menores')
@Controller('gastos-menores')
export class GastosMenoresController {
  constructor(private readonly gastosMenoresService: GastosMenoresService) {}

  @Post()
  @Permissions('gastosmenores.crear')
  crear(@Body() dto: CrearGastoMenorDto, @CurrentUser() user: JwtPayloadUser) {
    return this.gastosMenoresService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('gastosmenores.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.gastosMenoresService.listar(query);
  }

  @Get(':id')
  @Permissions('gastosmenores.ver')
  buscarPorId(@Param('id') id: string) {
    return this.gastosMenoresService.buscarPorId(id);
  }
}
