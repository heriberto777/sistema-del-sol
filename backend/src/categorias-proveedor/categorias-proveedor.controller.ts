import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategoriasProveedorService } from './categorias-proveedor.service';
import { CrearCategoriaProveedorDto } from './dto/crear-categoria-proveedor.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('categorias-proveedor')
@Controller('categorias-proveedor')
export class CategoriasProveedorController {
  constructor(private readonly categoriasProveedorService: CategoriasProveedorService) {}

  @Post()
  @Permissions('compras.editar')
  crear(@Body() dto: CrearCategoriaProveedorDto, @CurrentUser() user: JwtPayloadUser) {
    return this.categoriasProveedorService.crear(dto, user.tenantId);
  }

  // Sin permiso más restrictivo que compras.ver a propósito — mismo
  // criterio que CategoriasClienteController: cualquiera que necesite
  // elegir una categoría (formulario de Proveedor) la tiene, no solo quien
  // administra el catálogo.
  @Get()
  @Permissions('compras.ver')
  listar(@Query('activa') activa?: string) {
    return this.categoriasProveedorService.listar(activa === 'true');
  }

  @Patch(':id')
  @Permissions('compras.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearCategoriaProveedorDto>) {
    return this.categoriasProveedorService.actualizar(id, dto);
  }
}
