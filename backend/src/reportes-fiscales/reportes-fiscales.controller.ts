import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportesFiscalesService } from './reportes-fiscales.service';
import { ReporteFiscalQueryDto, ReporteFiscalExportarQueryDto } from './dto/reporte-fiscal-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('reportes-fiscales')
@Controller('reportes-fiscales')
export class ReportesFiscalesController {
  constructor(private readonly reportesFiscalesService: ReportesFiscalesService) {}

  private enviarTxt(res: Response, nombreArchivo: string, contenido: string) {
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    });
    res.send(contenido);
  }

  @Get('606')
  @Permissions('reportes.ver')
  formato606(@Query() query: ReporteFiscalQueryDto) {
    return this.reportesFiscalesService.formato606(query.desde, query.hasta);
  }

  @Get('606/exportar')
  @Permissions('reportes.ver')
  async exportar606(@Query() query: ReporteFiscalExportarQueryDto, @Res() res: Response) {
    if (query.formato === 'json') {
      return res.json(await this.reportesFiscalesService.formato606(query.desde, query.hasta));
    }
    const txt = await this.reportesFiscalesService.exportar606Txt(query.desde, query.hasta);
    this.enviarTxt(res, 'DGII_606.txt', txt);
  }

  @Get('607')
  @Permissions('reportes.ver')
  formato607(@Query() query: ReporteFiscalQueryDto) {
    return this.reportesFiscalesService.formato607(query.desde, query.hasta);
  }

  @Get('607/exportar')
  @Permissions('reportes.ver')
  async exportar607(@Query() query: ReporteFiscalExportarQueryDto, @Res() res: Response) {
    if (query.formato === 'json') {
      return res.json(await this.reportesFiscalesService.formato607(query.desde, query.hasta));
    }
    const txt = await this.reportesFiscalesService.exportar607Txt(query.desde, query.hasta);
    this.enviarTxt(res, 'DGII_607.txt', txt);
  }

  @Get('608')
  @Permissions('reportes.ver')
  formato608(@Query() query: ReporteFiscalQueryDto) {
    return this.reportesFiscalesService.formato608(query.desde, query.hasta);
  }

  @Get('608/exportar')
  @Permissions('reportes.ver')
  async exportar608(@Query() query: ReporteFiscalExportarQueryDto, @Res() res: Response) {
    if (query.formato === 'json') {
      return res.json(await this.reportesFiscalesService.formato608(query.desde, query.hasta));
    }
    const txt = await this.reportesFiscalesService.exportar608Txt(query.desde, query.hasta);
    this.enviarTxt(res, 'DGII_608.txt', txt);
  }

  @Get('itbis-resumen')
  @Permissions('reportes.ver')
  resumenItbis(@Query() query: ReporteFiscalQueryDto) {
    return this.reportesFiscalesService.resumenItbis(query.desde, query.hasta);
  }

  @Get('it-1')
  @Permissions('reportes.ver')
  formatoIT1(@Query() query: ReporteFiscalQueryDto) {
    return this.reportesFiscalesService.formatoIT1(query.desde, query.hasta);
  }

  @Get('retenciones-nomina')
  @Permissions('reportes.ver')
  retencionesNomina(@Query() query: ReporteFiscalQueryDto, @CurrentUser() user: JwtPayloadUser) {
    return this.reportesFiscalesService.retencionesNomina(user.tenantId, query.desde, query.hasta);
  }

  @Get('retenciones-proveedores')
  @Permissions('reportes.ver')
  retencionesProveedores(@Query() query: ReporteFiscalQueryDto) {
    return this.reportesFiscalesService.retencionesProveedores(query.desde, query.hasta);
  }
}
