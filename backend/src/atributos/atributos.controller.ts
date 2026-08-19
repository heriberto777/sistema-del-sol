import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AtributosService } from './atributos.service';
import { CrearAtributoDto } from './dto/crear-atributo.dto';
import { CrearValorAtributoDto } from './dto/crear-valor-atributo.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('atributos')
@Controller('atributos')
export class AtributosController {
  constructor(private readonly atributosService: AtributosService) {}

  @Post()
  @Permissions('precios.editar')
  crear(@Body() dto: CrearAtributoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.atributosService.crear(dto.nombre, user.tenantId);
  }

  // Sin permiso más restrictivo que precios.ver a propósito — cualquiera que
  // necesite armar/elegir variantes (formulario de Productos) lo tiene, no
  // solo quien administra el catálogo.
  @Get()
  @Permissions('precios.ver')
  listar() {
    return this.atributosService.listar();
  }

  @Post(':id/valores')
  @Permissions('precios.editar')
  crearValor(@Param('id') id: string, @Body() dto: CrearValorAtributoDto) {
    return this.atributosService.crearValor(id, dto.valor);
  }

  @Delete(':id/valores/:valorId')
  @Permissions('precios.editar')
  eliminarValor(@Param('id') id: string, @Param('valorId') valorId: string) {
    return this.atributosService.eliminarValor(id, valorId);
  }

  @Delete(':id')
  @Permissions('precios.editar')
  eliminarAtributo(@Param('id') id: string) {
    return this.atributosService.eliminarAtributo(id);
  }
}
