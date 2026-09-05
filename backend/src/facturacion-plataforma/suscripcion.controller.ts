import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SuscripcionesService } from './suscripciones.service';
import { ActualizarSuscripcionDto } from './dto/actualizar-suscripcion.dto';
import { GenerarFacturaAdelantadaDto } from './dto/generar-factura-adelantada.dto';
import { AplicarCuponDto } from './dto/aplicar-cupon.dto';
import { CuponesPlataformaService } from './cupones/cupones-plataforma.service';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';

@ApiBearerAuth()
@ApiTags('platform-suscripcion')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/tenants/:tenantId/suscripcion')
export class SuscripcionController {
  constructor(
    private readonly suscripcionesService: SuscripcionesService,
    private readonly cuponesPlataformaService: CuponesPlataformaService,
  ) {}

  @Get()
  @PlatformPermissions('platform.facturacion.ver')
  buscar(@Param('tenantId') tenantId: string) {
    return this.suscripcionesService.buscarPorTenant(tenantId);
  }

  @Patch()
  @PlatformPermissions('platform.facturacion.gestionar')
  actualizar(@Param('tenantId') tenantId: string, @Body() dto: ActualizarSuscripcionDto) {
    return this.suscripcionesService.actualizar(tenantId, dto);
  }

  @Post('generar-factura')
  @PlatformPermissions('platform.facturacion.gestionar')
  generarFactura(@Param('tenantId') tenantId: string) {
    return this.suscripcionesService.generarFacturaAhora(tenantId);
  }

  /** Pago adelantado — una sola factura por N ciclos (meses/años) del plan, adelanta fechaProximoCorte esa misma cantidad. */
  @Post('generar-factura-adelantada')
  @PlatformPermissions('platform.facturacion.gestionar')
  generarFacturaAdelantada(@Param('tenantId') tenantId: string, @Body() dto: GenerarFacturaAdelantadaDto) {
    return this.suscripcionesService.generarFacturaAdelantada(tenantId, dto.ciclos);
  }

  @Get('cupon')
  @PlatformPermissions('platform.facturacion.ver')
  verCupon(@Param('tenantId') tenantId: string) {
    return this.cuponesPlataformaService.buscarAplicacionActivaDeTenant(tenantId);
  }

  @Post('cupon')
  @PlatformPermissions('platform.facturacion.gestionar')
  aplicarCupon(@Param('tenantId') tenantId: string, @Body() dto: AplicarCuponDto) {
    return this.cuponesPlataformaService.aplicarATenant(tenantId, dto.codigo);
  }

  @Delete('cupon')
  @PlatformPermissions('platform.facturacion.gestionar')
  quitarCupon(@Param('tenantId') tenantId: string) {
    return this.cuponesPlataformaService.quitarDeTenant(tenantId);
  }
}
