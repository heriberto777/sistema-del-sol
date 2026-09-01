import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { FacturasPlataformaService } from './facturas-plataforma.service';
import { PagosPlataformaService } from './pagos-plataforma.service';
import { ListarFacturasPlataformaQueryDto } from './dto/listar-facturas-plataforma-query.dto';
import { ActualizarFacturaPlataformaDto } from './dto/actualizar-factura-plataforma.dto';
import { CrearFacturaPlataformaManualDto } from './dto/crear-factura-plataforma-manual.dto';
import { CrearPagoPlataformaDto } from './dto/crear-pago-plataforma.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';
import { CurrentPlatformAdmin } from '../platform-auth/current-platform-admin.decorator';
import { PlatformAdminPayload } from '../platform-auth/platform-authenticated-request';

@ApiBearerAuth()
@ApiTags('platform-facturas')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/facturas')
export class FacturasPlataformaController {
  constructor(
    private readonly facturasPlataformaService: FacturasPlataformaService,
    private readonly pagosPlataformaService: PagosPlataformaService,
  ) {}

  @Get()
  @PlatformPermissions('platform.facturacion.ver')
  listar(@Query() query: ListarFacturasPlataformaQueryDto) {
    return this.facturasPlataformaService.listar(query);
  }

  @Post()
  @PlatformPermissions('platform.facturacion.gestionar')
  crearManual(@Body() dto: CrearFacturaPlataformaManualDto) {
    return this.facturasPlataformaService.crearManual(dto);
  }

  @Get(':id')
  @PlatformPermissions('platform.facturacion.ver')
  buscarPorId(@Param('id') id: string) {
    return this.facturasPlataformaService.buscarPorId(id);
  }

  @Patch(':id')
  @PlatformPermissions('platform.facturacion.gestionar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarFacturaPlataformaDto) {
    return this.facturasPlataformaService.actualizar(id, dto);
  }

  @Get(':id/pdf')
  @PlatformPermissions('platform.facturacion.ver')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.facturasPlataformaService.generarPdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="factura.pdf"' });
    res.send(buffer);
  }

  @Post(':id/anular')
  @PlatformPermissions('platform.facturacion.gestionar')
  anular(@Param('id') id: string) {
    return this.facturasPlataformaService.anular(id);
  }

  @Get(':id/pagos')
  @PlatformPermissions('platform.facturacion.ver')
  listarPagos(@Param('id') id: string) {
    return this.pagosPlataformaService.listarPorFactura(id);
  }

  @Post(':id/pagos')
  @PlatformPermissions('platform.pagos.registrar')
  registrarPago(
    @Param('id') id: string,
    @Body() dto: CrearPagoPlataformaDto,
    @CurrentPlatformAdmin() admin: PlatformAdminPayload,
  ) {
    return this.pagosPlataformaService.registrar(id, dto, admin.adminId);
  }
}
