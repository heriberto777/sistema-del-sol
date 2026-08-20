import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HorariosService } from './horarios.service';
import { ReemplazarHorarioDto } from './dto/reemplazar-horario.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('nomina')
@RequiereModulo('nomina')
@Controller('nomina/empleados/:empleadoId/horario')
export class HorariosController {
  constructor(private readonly horariosService: HorariosService) {}

  @Get()
  @Permissions('rrhh.ver')
  listar(@Param('empleadoId') empleadoId: string) {
    return this.horariosService.listar(empleadoId);
  }

  @Put()
  @Permissions('rrhh.editar')
  reemplazar(@Param('empleadoId') empleadoId: string, @Body() dto: ReemplazarHorarioDto, @CurrentUser() user: JwtPayloadUser) {
    return this.horariosService.reemplazar(empleadoId, user.tenantId, dto);
  }
}
