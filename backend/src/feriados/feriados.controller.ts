import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FeriadosService } from './feriados.service';
import { CrearFeriadoDto } from './dto/crear-feriado.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('nomina')
@RequiereModulo('nomina')
@Controller('nomina/feriados')
export class FeriadosController {
  constructor(private readonly feriadosService: FeriadosService) {}

  @Post()
  @Permissions('rrhh.editar')
  crear(@Body() dto: CrearFeriadoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.feriadosService.crear(dto, user.tenantId);
  }

  // Sin permiso más restrictivo que rrhh.ver a propósito — igual criterio
  // que ListasPrecioController: cualquiera que necesite el calendario para
  // consulta (asistencia, nómina) lo tiene, no solo quien lo administra.
  @Get()
  @Permissions('rrhh.ver')
  listar(@Query('activo') activo?: string) {
    return this.feriadosService.listar(activo === 'true');
  }

  @Patch(':id')
  @Permissions('rrhh.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearFeriadoDto>) {
    return this.feriadosService.actualizar(id, dto);
  }

  @Delete(':id')
  @Permissions('rrhh.editar')
  eliminar(@Param('id') id: string) {
    return this.feriadosService.eliminar(id);
  }
}
