import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ListasPrecioService } from './listas-precio.service';
import { CrearListaPrecioDto } from './dto/crear-lista-precio.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('listas-precio')
@Controller('listas-precio')
export class ListasPrecioController {
  constructor(private readonly listasPrecioService: ListasPrecioService) {}

  @Post()
  @Permissions('precios.editar')
  crear(@Body() dto: CrearListaPrecioDto, @CurrentUser() user: JwtPayloadUser) {
    return this.listasPrecioService.crear(dto, user.tenantId);
  }

  // Sin permiso más restrictivo que precios.ver a propósito — cualquiera que
  // necesite elegir un nivel de precio (formulario de Cliente, override al
  // facturar/POS) lo tiene, no solo quien administra el catálogo.
  @Get()
  @Permissions('precios.ver')
  listar(@Query('activa') activa?: string) {
    return this.listasPrecioService.listar(activa === 'true');
  }

  @Patch(':id')
  @Permissions('precios.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearListaPrecioDto>) {
    return this.listasPrecioService.actualizar(id, dto);
  }
}
