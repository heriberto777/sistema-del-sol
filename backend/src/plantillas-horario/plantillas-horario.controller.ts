import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlantillasHorarioService } from './plantillas-horario.service';
import { CrearPlantillaHorarioDto } from './dto/crear-plantilla-horario.dto';
import { ReemplazarDiasPlantillaDto } from './dto/reemplazar-dias-plantilla.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('nomina')
@RequiereModulo('nomina')
@Controller('nomina/plantillas-horario')
export class PlantillasHorarioController {
  constructor(private readonly plantillasHorarioService: PlantillasHorarioService) {}

  @Post()
  @Permissions('rrhh.editar')
  crear(@Body() dto: CrearPlantillaHorarioDto, @CurrentUser() user: JwtPayloadUser) {
    return this.plantillasHorarioService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('rrhh.ver')
  listar(@Query('activa') activa?: string) {
    return this.plantillasHorarioService.listar(activa === 'true');
  }

  @Get(':id')
  @Permissions('rrhh.ver')
  buscarPorId(@Param('id') id: string) {
    return this.plantillasHorarioService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('rrhh.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearPlantillaHorarioDto>, @CurrentUser() user: JwtPayloadUser) {
    return this.plantillasHorarioService.actualizar(id, dto, user.tenantId);
  }

  @Put(':id/dias')
  @Permissions('rrhh.editar')
  reemplazarDias(@Param('id') id: string, @Body() dto: ReemplazarDiasPlantillaDto) {
    return this.plantillasHorarioService.reemplazarDias(id, dto);
  }
}
