import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TareasProyectoService } from './tareas-proyecto.service';
import { CrearTareaProyectoDto } from './dto/crear-tarea-proyecto.dto';
import { CrearRegistroHoraDto } from './dto/crear-registro-hora.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/** Rutas de Tarea/responsables/horas, separadas de `ProyectosController` por tamaño — mismo prefijo `admin/proyectos`, sin colisión (segmentos literales distintos, ver comentario en el módulo). */
@ApiBearerAuth()
@ApiTags('proyectos')
@RequiereModulo('proyectos')
@Controller('admin/proyectos')
export class TareasProyectoController {
  constructor(private readonly tareasProyectoService: TareasProyectoService) {}

  @Post(':proyectoId/tareas')
  @Permissions('proyectos.crear')
  crear(@Param('proyectoId') proyectoId: string, @Body() dto: CrearTareaProyectoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.tareasProyectoService.crear(proyectoId, dto, user.tenantId);
  }

  @Get('tareas/:id')
  @Permissions('proyectos.ver')
  buscarPorId(@Param('id') id: string) {
    return this.tareasProyectoService.buscarPorId(id);
  }

  @Patch('tareas/:id')
  @Permissions('proyectos.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearTareaProyectoDto>) {
    return this.tareasProyectoService.actualizar(id, dto);
  }

  @Delete('tareas/:id')
  @Permissions('proyectos.editar')
  eliminar(@Param('id') id: string) {
    return this.tareasProyectoService.eliminar(id);
  }

  // ---------- Responsables ----------

  @Post('tareas/:id/responsables/:empleadoId')
  @Permissions('proyectos.editar')
  asignarResponsable(@Param('id') id: string, @Param('empleadoId') empleadoId: string) {
    return this.tareasProyectoService.asignarResponsable(id, empleadoId);
  }

  @Delete('tareas/:id/responsables/:empleadoId')
  @Permissions('proyectos.editar')
  quitarResponsable(@Param('id') id: string, @Param('empleadoId') empleadoId: string) {
    return this.tareasProyectoService.quitarResponsable(id, empleadoId);
  }

  // ---------- Registro de horas ----------
  // Permiso separado de `.editar` a propósito (ver roles-base.ts): un
  // empleado con solo `proyectos.horas.registrar` puede cargar sus propias
  // horas sin poder editar la tarea entera.

  @Post('tareas/:id/horas')
  @Permissions('proyectos.horas.registrar')
  registrarHora(@Param('id') id: string, @Body() dto: CrearRegistroHoraDto, @CurrentUser() user: JwtPayloadUser) {
    return this.tareasProyectoService.registrarHora(id, dto, user.tenantId);
  }

  @Delete('horas/:id')
  @Permissions('proyectos.horas.registrar')
  eliminarRegistroHora(@Param('id') id: string) {
    return this.tareasProyectoService.eliminarRegistroHora(id);
  }
}
