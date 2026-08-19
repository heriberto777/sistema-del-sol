import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductosService } from './productos.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { CatalogoQueryDto } from './dto/catalogo-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('productos')
@RequiereModulo('productos')
@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  @Permissions('precios.editar')
  crear(@Body() dto: CrearProductoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.productosService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('precios.ver')
  listar(@Query() query: CatalogoQueryDto) {
    return this.productosService.listar(query);
  }

  // Antes de ':id' a propósito — mismo motivo que /clientes/consumidor-final:
  // si no, Nest matchea "catalogo" como si fuera un :id. El árbol de
  // categorías vive en /categorias (CategoriasModule), no acá.
  @Get('catalogo')
  @Permissions('precios.ver')
  catalogo(@Query() query: CatalogoQueryDto) {
    return this.productosService.catalogo(query);
  }

  @Get(':id')
  @Permissions('precios.ver')
  buscarPorId(@Param('id') id: string) {
    return this.productosService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('precios.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearProductoDto>) {
    return this.productosService.actualizar(id, dto);
  }
}
