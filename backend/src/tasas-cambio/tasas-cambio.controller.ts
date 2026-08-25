import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TasasCambioService } from './tasas-cambio.service';
import { CrearTasaCambioDto } from './dto/crear-tasa-cambio.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/** Ítem C-2 (multi-moneda) — catálogo manual de tasas de cambio, sin feed automático. */
@ApiBearerAuth()
@ApiTags('tasas-cambio')
@Controller('tasas-cambio')
export class TasasCambioController {
  constructor(private readonly tasasCambioService: TasasCambioService) {}

  @Post()
  @Permissions('admin.configuracion')
  crear(@Body() dto: CrearTasaCambioDto, @CurrentUser() user: JwtPayloadUser) {
    return this.tasasCambioService.crear(dto, user.tenantId);
  }

  // Sin permiso más restrictivo a propósito — cualquiera que factura
  // necesita ver qué monedas están configuradas (selector en Facturación/POS).
  @Get()
  @Permissions('facturacion.crear')
  listar() {
    return this.tasasCambioService.listar();
  }

  @Patch(':id')
  @Permissions('admin.configuracion')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearTasaCambioDto>) {
    return this.tasasCambioService.actualizar(id, dto);
  }

  @Delete(':id')
  @Permissions('admin.configuracion')
  eliminar(@Param('id') id: string) {
    return this.tasasCambioService.eliminar(id);
  }
}
