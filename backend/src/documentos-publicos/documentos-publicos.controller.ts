import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { DocumentosPublicosService } from './documentos-publicos.service';
import { ResponderCotizacionDto } from './dto/responder-cotizacion.dto';
import { Public } from '../common/decorators/public.decorator';

/**
 * Ítem H-4 — público, sin JWT, mismo criterio que
 * `pasarela-cobro/cobros-publicos.controller.ts`: el cliente ve SU
 * documento desde el link que llega en el email/WhatsApp, sin cuenta en
 * el sistema. El UUID en la URL actúa como capability token implícito.
 */
@ApiTags('documentos-publicos')
@Public()
@Controller('documentos-publicos')
export class DocumentosPublicosController {
  constructor(private readonly documentosPublicosService: DocumentosPublicosService) {}

  @Get('facturas/:id')
  obtenerFactura(@Param('id') id: string) {
    return this.documentosPublicosService.obtenerFactura(id);
  }

  @Get('facturas/:id/pdf')
  async pdfFactura(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.documentosPublicosService.obtenerFacturaPdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="factura.pdf"' });
    res.send(buffer);
  }

  @Get('cotizaciones/:id')
  obtenerCotizacion(@Param('id') id: string) {
    return this.documentosPublicosService.obtenerCotizacion(id);
  }

  @Get('cotizaciones/:id/pdf')
  async pdfCotizacion(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.documentosPublicosService.obtenerCotizacionPdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="cotizacion.pdf"' });
    res.send(buffer);
  }

  /** CRM "Cotización conectada" — el cliente aprueba/rechaza sin login, mismo criterio de "UUID como capability token" que el resto de este controller. */
  @Post('cotizaciones/:id/responder')
  responderCotizacion(@Param('id') id: string, @Body() dto: ResponderCotizacionDto) {
    return this.documentosPublicosService.responderCotizacion(id, dto);
  }

  @Get('clientes/:id/estado-cuenta/pdf')
  async pdfEstadoCuenta(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.documentosPublicosService.obtenerEstadoCuentaPdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="estado-de-cuenta.pdf"' });
    res.send(buffer);
  }
}
