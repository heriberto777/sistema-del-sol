import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FacturasProveedorService } from './facturas-proveedor.service';
import { CrearFacturaProveedorDto } from './dto/crear-factura-proveedor.dto';
import { ExtraerFacturaProveedorDto } from './dto/extraer-factura-proveedor.dto';
import { CrearPagoOrdenCompraDto } from '../compras/dto/crear-pago-orden-compra.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('facturas-proveedor')
@RequiereModulo('compras')
@Controller('facturas-proveedor')
export class FacturasProveedorController {
  constructor(private readonly facturasProveedorService: FacturasProveedorService) {}

  @Post()
  @Permissions('facturasproveedor.crear')
  crear(@Body() dto: CrearFacturaProveedorDto, @CurrentUser() user: JwtPayloadUser) {
    return this.facturasProveedorService.crear(dto, user.tenantId, user.userId);
  }

  // Benchmark 2026-11-09 (Fase 10) — "crear desde imagen/PDF", antes de
  // ':id' a propósito (mismo cuidado de orden que el resto de rutas
  // literales de este tipo de controller).
  @Post('extraer-desde-archivo')
  @Permissions('facturasproveedor.crear')
  extraerDesdeArchivo(@Body() dto: ExtraerFacturaProveedorDto, @CurrentUser() user: JwtPayloadUser) {
    return this.facturasProveedorService.extraerDesdeArchivo(dto.archivo, user.tenantId);
  }

  @Get()
  @Permissions('facturasproveedor.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.facturasProveedorService.listar(query);
  }

  @Get(':id')
  @Permissions('facturasproveedor.ver')
  buscarPorId(@Param('id') id: string) {
    return this.facturasProveedorService.buscarPorId(id);
  }

  @Post(':id/anular')
  @Permissions('facturasproveedor.anular')
  anular(@Param('id') id: string) {
    return this.facturasProveedorService.anular(id);
  }

  @Post(':id/pagos')
  @Permissions('facturasproveedor.pagar')
  registrarPago(@Param('id') id: string, @Body() dto: CrearPagoOrdenCompraDto, @CurrentUser() user: JwtPayloadUser) {
    return this.facturasProveedorService.registrarPago(id, dto, user.userId, user.tenantId);
  }

  @Get(':id/pagos')
  @Permissions('facturasproveedor.ver')
  async listarPagos(@Param('id') id: string) {
    await this.facturasProveedorService.buscarPorId(id);
    return this.facturasProveedorService.listarPagos(id);
  }
}
