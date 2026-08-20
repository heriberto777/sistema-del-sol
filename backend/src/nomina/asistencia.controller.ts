import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AsistenciaService } from './asistencia.service';
import { RegistrarAsistenciaManualDto } from './dto/registrar-asistencia-manual.dto';
import { ListarAsistenciaQueryDto } from './dto/listar-asistencia-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('nomina')
@RequiereModulo('nomina')
@Controller('nomina/asistencia')
export class AsistenciaController {
  constructor(private readonly asistenciaService: AsistenciaService) {}

  // Sin @Permissions — autoservicio: cualquier usuario logueado con un
  // Empleado vinculado (Empleado.userId) puede marcar SU PROPIA entrada/
  // salida. Deliberadamente separado del login/logout del sistema.
  @Get('mi-estado-hoy')
  miEstadoHoy(@CurrentUser() user: JwtPayloadUser) {
    return this.asistenciaService.miEstadoHoy(user.userId, user.tenantId);
  }

  @Post('marcar-entrada')
  marcarEntrada(@CurrentUser() user: JwtPayloadUser) {
    return this.asistenciaService.marcarEntrada(user.userId, user.tenantId);
  }

  @Post('marcar-salida')
  marcarSalida(@CurrentUser() user: JwtPayloadUser) {
    return this.asistenciaService.marcarSalida(user.userId, user.tenantId);
  }

  @Post()
  @Permissions('rrhh.editar')
  registrarManual(@Body() dto: RegistrarAsistenciaManualDto, @CurrentUser() user: JwtPayloadUser) {
    return this.asistenciaService.registrarManual(dto, user.tenantId);
  }

  @Get()
  @Permissions('rrhh.ver')
  listar(@Query() query: ListarAsistenciaQueryDto) {
    return this.asistenciaService.listar(query);
  }
}
