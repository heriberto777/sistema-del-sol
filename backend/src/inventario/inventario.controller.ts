import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InventarioService } from './inventario.service';
import { AjustarStockDto } from './dto/ajustar-stock.dto';
import { TransferirStockDto } from './dto/transferir-stock.dto';
import { CrearBodegaDto } from './dto/crear-bodega.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('inventario')
@Controller('inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get('bodegas')
  @Permissions('inventario.ver')
  listarBodegas() {
    return this.inventarioService.listarBodegas();
  }

  @Post('bodegas')
  @Permissions('admin.configuracion')
  crearBodega(@Body() dto: CrearBodegaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.inventarioService.crearBodega(user.tenantId, dto.nombre, dto.direccion);
  }

  @Get('stock/:bodegaId')
  @Permissions('inventario.ver')
  listarStock(@Param('bodegaId') bodegaId: string) {
    return this.inventarioService.listarStockPorBodega(bodegaId);
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
