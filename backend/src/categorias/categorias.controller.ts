import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategoriasService } from './categorias.service';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('categorias')
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  @Permissions('precios.editar')
  crear(@Body() dto: CrearCategoriaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.categoriasService.crear(dto, user.tenantId);
  }

  // Sin permiso más restrictivo que precios.ver a propósito — cualquiera que
  // necesite filtrar/armar el árbol de categorías (Productos, catálogo del
  // POS) lo tiene, no solo quien administra el catálogo.
  @Get()
  @Permissions('precios.ver')
  listar() {
    return this.categoriasService.listar();
  }

  @Patch(':id')
  @Permissions('precios.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearCategoriaDto>) {
    return this.categoriasService.actualizar(id, dto);
  }

  @Delete(':id')
  @Permissions('precios.editar')
  eliminar(@Param('id') id: string) {
    return this.categoriasService.eliminar(id);
  }
}
