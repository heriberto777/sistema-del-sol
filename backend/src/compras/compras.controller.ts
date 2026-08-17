import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ComprasService } from './compras.service';
import { CrearOrdenCompraDto } from './dto/crear-orden-compra.dto';
import { RecibirOrdenCompraDto } from './dto/recibir-orden-compra.dto';
import { DevolverOrdenCompraDto } from './dto/devolver-orden-compra.dto';
import { CrearPagoOrdenCompraDto } from './dto/crear-pago-orden-compra.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('compras')
@RequiereModulo('compras')
@Controller('compras')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Post()
  @Permissions('compras.crear')
  crear(@Body() dto: CrearOrdenCompraDto, @CurrentUser() user: JwtPayloadUser) {
    return this.comprasService.crear(dto, user.userId, user.tenantId);
  }

  @Get()
  @Permissions('compras.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.comprasService.listar(query);
  }

  @Get(':id')
  @Permissions('compras.ver')
  buscarPorId(@Param('id') id: string) {
    return this.comprasService.buscarPorId(id);
  }

  @Post(':id/recibir')
  @Permissions('compras.recibir')
  recibir(@Param('id') id: string, @Body() dto: RecibirOrdenCompraDto, @CurrentUser() user: JwtPayloadUser) {
    return this.comprasService.recibir(id, dto, user.userId, user.tenantId);
  }

  @Post(':id/devolver')
  @Permissions('compras.recibir')
  devolver(@Param('id') id: string, @Body() dto: DevolverOrdenCompraDto, @CurrentUser() user: JwtPayloadUser) {
    return this.comprasService.devolver(id, dto, user.userId, user.tenantId);
  }

  @Post(':id/pagos')
  @Permissions('compras.pagar')
  registrarPago(@Param('id') id: string, @Body() dto: CrearPagoOrdenCompraDto, @CurrentUser() user: JwtPayloadUser) {
    return this.comprasService.registrarPago(id, dto, user.userId, user.tenantId);
  }

  @Get(':id/pagos')
  @Permissions('compras.ver')
  async listarPagos(@Param('id') id: string) {
    await this.comprasService.buscarPorId(id);
    return this.comprasService.listarPagos(id);
  }
}
