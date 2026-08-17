import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BancosService } from './bancos.service';
import { CrearCuentaBancariaDto } from './dto/crear-cuenta-bancaria.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('bancos')
@RequiereModulo('bancos')
@Controller('bancos')
export class BancosController {
  constructor(private readonly bancosService: BancosService) {}

  @Post()
  @Permissions('bancos.editar')
  crear(@Body() dto: CrearCuentaBancariaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.bancosService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('bancos.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.bancosService.listar(query);
  }

  @Get(':id')
  @Permissions('bancos.ver')
  buscarPorId(@Param('id') id: string) {
    return this.bancosService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('bancos.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearCuentaBancariaDto>) {
    return this.bancosService.actualizar(id, dto);
  }
}
