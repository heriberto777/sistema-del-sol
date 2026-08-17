import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PreciosService } from './precios.service';
import { CrearPrecioDto } from './dto/crear-precio.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';

@ApiBearerAuth()
@ApiTags('precios')
@RequiereModulo('productos')
@Controller('precios')
export class PreciosController {
  constructor(private readonly preciosService: PreciosService) {}

  @Get(':productoId')
  @Permissions('precios.ver')
  vigente(@Param('productoId') productoId: string, @Query('listaPrecio') listaPrecio?: string) {
    return this.preciosService.vigente(productoId, listaPrecio);
  }

  @Get(':productoId/historial')
  @Permissions('precios.ver')
  historial(@Param('productoId') productoId: string, @Query('listaPrecio') listaPrecio?: string) {
    return this.preciosService.historial(productoId, listaPrecio);
  }

  @Post()
  @Permissions('precios.editar')
  crear(@Body() dto: CrearPrecioDto) {
    return this.preciosService.crear(dto);
  }
}
