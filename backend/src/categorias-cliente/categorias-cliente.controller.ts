import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategoriasClienteService } from './categorias-cliente.service';
import { CrearCategoriaClienteDto } from './dto/crear-categoria-cliente.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('categorias-cliente')
@Controller('categorias-cliente')
export class CategoriasClienteController {
  constructor(private readonly categoriasClienteService: CategoriasClienteService) {}

  @Post()
  @Permissions('clientes.editar')
  crear(@Body() dto: CrearCategoriaClienteDto, @CurrentUser() user: JwtPayloadUser) {
    return this.categoriasClienteService.crear(dto, user.tenantId);
  }

  // Sin permiso más restrictivo que clientes.ver a propósito — mismo
  // criterio que ListasPrecioController: cualquiera que necesite elegir
  // una categoría (formulario de Cliente) la tiene, no solo quien
  // administra el catálogo.
  @Get()
  @Permissions('clientes.ver')
  listar(@Query('activa') activa?: string) {
    return this.categoriasClienteService.listar(activa === 'true');
  }

  @Patch(':id')
  @Permissions('clientes.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearCategoriaClienteDto>) {
    return this.categoriasClienteService.actualizar(id, dto);
  }
}
