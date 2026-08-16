import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EstadosFinancierosService } from './estados-financieros.service';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ReporteFiscalQueryDto } from '../reportes-fiscales/dto/reporte-fiscal-query.dto';

@ApiBearerAuth()
@ApiTags('contabilidad')
@Controller('contabilidad')
export class EstadosFinancierosController {
  constructor(private readonly estadosFinancierosService: EstadosFinancierosService) {}

  @Get('balance-general')
  @Permissions('contabilidad.ver')
  balanceGeneral(@Query('fecha') fecha?: string) {
    return this.estadosFinancierosService.balanceGeneral(fecha);
  }

  @Get('estado-resultados')
  @Permissions('contabilidad.ver')
  estadoResultados(@Query() query: ReporteFiscalQueryDto) {
    return this.estadosFinancierosService.estadoResultados(query.desde, query.hasta);
  }

  @Get('libro-mayor/:cuentaId')
  @Permissions('contabilidad.ver')
  libroMayor(@Param('cuentaId') cuentaId: string, @Query() query: ReporteFiscalQueryDto) {
    return this.estadosFinancierosService.libroMayor(cuentaId, query.desde, query.hasta);
  }
}
