import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PuestosService } from './puestos.service';
import { CrearPuestoDto } from './dto/crear-puesto.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('nomina')
@RequiereModulo('nomina')
@Controller('nomina/puestos')
export class PuestosController {
  constructor(private readonly puestosService: PuestosService) {}

  @Post()
  @Permissions('nomina.editar')
  crear(@Body() dto: CrearPuestoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.puestosService.crear(dto, user.tenantId);
  }

  // Sin permiso más restrictivo que nomina.ver a propósito — mismo
  // criterio que ListasPrecioController: cualquiera que necesite elegir
  // un puesto (formulario de Empleado) lo tiene, no solo quien administra
  // el catálogo.
  @Get()
  @Permissions('nomina.ver')
  listar(@Query('activo') activo?: string) {
    return this.puestosService.listar(activo === 'true');
  }

  @Patch(':id')
  @Permissions('nomina.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearPuestoDto>) {
    return this.puestosService.actualizar(id, dto);
  }
}
