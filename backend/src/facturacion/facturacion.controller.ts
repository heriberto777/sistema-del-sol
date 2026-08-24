import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { FacturacionService } from './facturacion.service';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { AnularFacturaDto } from './dto/anular-factura.dto';
import { CrearPagoDto } from '../pagos/dto/crear-pago.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListarFacturasQueryDto } from './dto/listar-facturas-query.dto';
import { ImprimirDocumentoQueryDto } from '../common/impresion/dto/imprimir-documento-query.dto';
import { EnviarReciboDto } from './dto/enviar-recibo.dto';

@ApiBearerAuth()
@ApiTags('facturacion')
@RequiereModulo('facturacion')
@Controller('facturas')
export class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) {}

  @Post()
  @Permissions('facturacion.crear')
  crear(@Body() dto: CrearFacturaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.facturacionService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('facturacion.ver')
  listar(@Query() query: ListarFacturasQueryDto) {
    return this.facturacionService.listar(query);
  }

  @Get(':id')
  @Permissions('facturacion.ver')
  buscarPorId(@Param('id') id: string) {
    return this.facturacionService.buscarPorId(id);
  }

  @Get(':id/pdf')
  @Permissions('facturacion.imprimir')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.facturacionService.generarPdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="factura.pdf"' });
    res.send(buffer);
  }

  // facturacion.imprimir, no facturacion.ver: separado a propósito para que
  // Vendedor pueda imprimir el recibo de una venta de POS sin necesitar
  // acceso a la pantalla general de Facturación (ver roles-base.ts).
  @Get(':id/imprimir')
  @Permissions('facturacion.imprimir')
  async imprimir(
    @Param('id') id: string,
    @Query() query: ImprimirDocumentoQueryDto,
    @CurrentUser() user: JwtPayloadUser,
    @Res() res: Response,
  ) {
    const { buffer, contentType } = await this.facturacionService.generarImpreso(id, query.formato, user.tenantId);
    res.set({ 'Content-Type': contentType, 'Content-Disposition': 'inline; filename="factura"' });
    res.send(buffer);
  }

  // facturacion.imprimir, mismo criterio que /imprimir y /pdf — entregar
  // el recibo es otra forma de "imprimirlo", no requiere facturacion.ver.
  @Post(':id/enviar-recibo')
  @Permissions('facturacion.imprimir')
  enviarRecibo(@Param('id') id: string, @Body() dto: EnviarReciboDto, @CurrentUser() user: JwtPayloadUser) {
    return this.facturacionService.enviarRecibo(id, dto, user.tenantId);
  }

  @Post(':id/anular')
  @Permissions('facturacion.anular')
  anular(@Param('id') id: string, @Body() dto: AnularFacturaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.facturacionService.anular(id, dto.motivo, user.tenantId, user.userId, user.permisos.includes('pos.supervisar'), dto.pin);
  }

  @Post(':id/pagos')
  @Permissions('facturacion.cobrar')
  registrarPago(@Param('id') id: string, @Body() dto: CrearPagoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.facturacionService.registrarPago(id, dto, user.userId, user.tenantId);
  }

  @Get(':id/pagos')
  @Permissions('facturacion.ver')
  async listarPagos(@Param('id') id: string) {
    await this.facturacionService.buscarPorId(id);
    return this.facturacionService.listarPagos(id);
  }
}
