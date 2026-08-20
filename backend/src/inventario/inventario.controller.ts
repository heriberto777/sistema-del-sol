import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InventarioService } from './inventario.service';
import { AjustarStockDto } from './dto/ajustar-stock.dto';
import { TransferirStockDto } from './dto/transferir-stock.dto';
import { CrearBodegaDto } from './dto/crear-bodega.dto';
import { ActualizarBodegaDto } from './dto/actualizar-bodega.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { KardexQueryDto } from './dto/kardex-query.dto';
import { LotesQueryDto } from './dto/lotes-query.dto';
import { VencimientosQueryDto } from './dto/vencimientos-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('inventario')
@RequiereModulo('inventario')
@Controller('inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  // Sin @Permissions a propósito: es una lista de nombres de bodega, sin
  // datos sensibles, usada como referencia por pantallas fuera de
  // Inventario (ej. AbrirTurnoForm del POS) — un Cajero necesita verla
  // para abrir su turno aunque no tenga inventario.ver (bug real
  // encontrado al construir Formas de Pago, ver docs/ARCHITECTURE.md).
  @Get('bodegas')
  listarBodegas() {
    return this.inventarioService.listarBodegas();
  }

  @Post('bodegas')
  @Permissions('admin.configuracion')
  crearBodega(@Body() dto: CrearBodegaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.inventarioService.crearBodega(user.tenantId, dto.sucursalId, dto.nombre, dto.direccion);
  }

  @Patch('bodegas/:id')
  @Permissions('admin.configuracion')
  actualizarBodega(@Param('id') id: string, @Body() dto: ActualizarBodegaDto) {
    return this.inventarioService.actualizarBodega(id, dto);
  }

  @Get('stock/:bodegaId')
  @Permissions('inventario.ver')
  listarStock(@Param('bodegaId') bodegaId: string, @Query() query: ListadoQueryDto) {
    return this.inventarioService.listarStockPorBodega(bodegaId, query);
  }

  // Fase 5a — historial cronológico con saldo corriente, mismo criterio de
  // permiso que el resto de consultas de solo lectura de Inventario.
  @Get('kardex/:varianteId')
  @Permissions('inventario.ver')
  kardex(@Param('varianteId') varianteId: string, @Query() query: KardexQueryDto) {
    return this.inventarioService.kardex(varianteId, query.bodegaId, query.desde, query.hasta);
  }

  // Fase 5b — para elegir "de qué lote sale" en devolución a proveedor / ajuste manual negativo.
  @Get('lotes')
  @Permissions('inventario.ver')
  listarLotes(@Query() query: LotesQueryDto) {
    return this.inventarioService.listarLotes(query.varianteId, query.bodegaId);
  }

  // Fase 5b — todas las bodegas del tenant, sin paginar (Patrón A de reportes/).
  @Get('vencimientos')
  @Permissions('inventario.ver')
  vencimientos(@Query() query: VencimientosQueryDto) {
    return this.inventarioService.vencimientos(query.diasProximidad);
  }

  @Post('ajustar')
  @Permissions('inventario.ajustar')
  ajustar(@Body() dto: AjustarStockDto, @CurrentUser() user: JwtPayloadUser) {
    return this.inventarioService.ajustarStock({ ...dto, tenantId: user.tenantId, userId: user.userId });
  }

  @Post('transferir')
  @Permissions('inventario.transferir')
  transferir(@Body() dto: TransferirStockDto, @CurrentUser() user: JwtPayloadUser) {
    return this.inventarioService.transferirStock({ ...dto, tenantId: user.tenantId, userId: user.userId });
  }
}
