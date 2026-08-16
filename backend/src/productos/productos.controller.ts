import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductosService } from './productos.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('productos')
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
  listar(@Query() query: ListadoQueryDto) {
    return this.productosService.listar(query);
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
