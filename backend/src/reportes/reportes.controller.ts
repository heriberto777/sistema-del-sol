import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportesService, ArchivoGenerado } from './reportes.service';
import { ReporteQueryDto, ExportarReporteQueryDto, FormatoQueryDto } from './dto/reporte-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('reportes')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  private enviarArchivo(res: Response, archivo: ArchivoGenerado) {
    res.set({
      'Content-Type': archivo.mimeType,
      'Content-Disposition': `attachment; filename="${archivo.nombreArchivo}"`,
      'Content-Length': archivo.buffer.length,
    });
    res.send(archivo.buffer);
  }

  @Get('dashboard')
  @Permissions('reportes.ver')
  dashboard(@CurrentUser() user: JwtPayloadUser) {
    return this.reportesService.dashboard(user.tenantId);
  }

  @Get('ventas')
  @Permissions('reportes.ver')
  reporteVentas(@Query() query: ReporteQueryDto) {
    return this.reportesService.reporteVentas(query.desde, query.hasta);
  }

  @Get('ventas/exportar')
  @Permissions('reportes.ver')
  async exportarVentas(@Query() query: ExportarReporteQueryDto, @Res() res: Response) {
    const archivo = await this.reportesService.exportarVentas(query.desde, query.hasta, query.formato);
    this.enviarArchivo(res, archivo);
  }

  @Get('inventario')
  @Permissions('reportes.ver')
  reporteInventario(@CurrentUser() user: JwtPayloadUser) {
    return this.reportesService.reporteInventario(user.tenantId);
  }

  @Get('inventario/exportar')
  @Permissions('reportes.ver')
  async exportarInventario(@Query() query: FormatoQueryDto, @CurrentUser() user: JwtPayloadUser, @Res() res: Response) {
    const archivo = await this.reportesService.exportarInventario(user.tenantId, query.formato);
    this.enviarArchivo(res, archivo);
  }

  @Get('compras')
  @Permissions('reportes.ver')
  reporteCompras(@Query() query: ReporteQueryDto) {
    return this.reportesService.reporteCompras(query.desde, query.hasta);
  }

  @Get('compras/exportar')
  @Permissions('reportes.ver')
  async exportarCompras(@Query() query: ExportarReporteQueryDto, @Res() res: Response) {
    const archivo = await this.reportesService.exportarCompras(query.desde, query.hasta, query.formato);
    this.enviarArchivo(res, archivo);
  }
}
