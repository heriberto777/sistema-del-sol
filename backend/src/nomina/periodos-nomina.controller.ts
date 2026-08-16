import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PeriodosNominaService } from './periodos-nomina.service';
import { GenerarPeriodoDto } from './dto/generar-periodo.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('nomina')
@Controller('nomina/periodos')
export class PeriodosNominaController {
  constructor(private readonly periodosNominaService: PeriodosNominaService) {}

  @Post()
  @Permissions('nomina.editar')
  generar(@Body() dto: GenerarPeriodoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.periodosNominaService.generarPeriodo(dto, user.tenantId);
  }

  @Get()
  @Permissions('nomina.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.periodosNominaService.listar(query);
  }

  @Get(':id')
  @Permissions('nomina.ver')
  buscarPorId(@Param('id') id: string) {
    return this.periodosNominaService.buscarPorId(id);
  }

  @Get(':id/reporte-aportes')
  @Permissions('nomina.ver')
  reporteAportes(@Param('id') id: string) {
    return this.periodosNominaService.reporteAportes(id);
  }

  @Post(':id/procesar')
  @Permissions('nomina.editar')
  procesar(@Param('id') id: string) {
    return this.periodosNominaService.procesar(id);
  }

  @Post(':id/marcar-pagado')
  @Permissions('nomina.editar')
  marcarPagado(@Param('id') id: string) {
    return this.periodosNominaService.marcarPagado(id);
  }
}
