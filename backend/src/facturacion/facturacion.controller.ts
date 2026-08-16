import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { FacturacionService } from './facturacion.service';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { AnularFacturaDto } from './dto/anular-factura.dto';
import { CrearPagoDto } from '../pagos/dto/crear-pago.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('facturacion')
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
  listar(@Query() query: ListadoQueryDto) {
    return this.facturacionService.listar(query);
  }

  @Get(':id')
  @Permissions('facturacion.ver')
  buscarPorId(@Param('id') id: string) {
    return this.facturacionService.buscarPorId(id);
  }

  @Get(':id/pdf')
  @Permissions('facturacion.ver')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.facturacionService.generarPdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="factura.pdf"' });
    res.send(buffer);
  }

  @Post(':id/anular')
  @Permissions('facturacion.anular')
  anular(@Param('id') id: string, @Body() dto: AnularFacturaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.facturacionService.anular(id, dto.motivo, user.tenantId, user.userId);
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
