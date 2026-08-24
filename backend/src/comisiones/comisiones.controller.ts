import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ComisionesService } from './comisiones.service';
import { ComisionQueryDto } from './dto/comision-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';

/** Ítem A-1 — 3 reportes de comisiones de venta (por venta/vendedor/producto), mismo shape que Cuadre. */
@ApiBearerAuth()
@ApiTags('comisiones')
@Controller('comisiones')
export class ComisionesController {
  constructor(private readonly comisionesService: ComisionesService) {}

  @Get('por-venta')
  @Permissions('comisiones.ver')
  reportePorVenta(@Query() query: ComisionQueryDto) {
    return this.comisionesService.reportePorVenta(query.desde, query.hasta);
  }

  @Get('por-vendedor')
  @Permissions('comisiones.ver')
  reportePorVendedor(@Query() query: ComisionQueryDto) {
    return this.comisionesService.reportePorVendedor(query.desde, query.hasta);
  }

  @Get('por-producto')
  @Permissions('comisiones.ver')
  reportePorProducto(@Query() query: ComisionQueryDto) {
    return this.comisionesService.reportePorProducto(query.desde, query.hasta);
  }
}
