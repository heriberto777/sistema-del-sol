import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TareasPersonalesService } from './tareas-personales.service';
import { CrearTareaPersonalDto } from './dto/crear-tarea-personal.dto';
import { CrearComentarioTareaPersonalDto } from './dto/crear-comentario-tarea-personal.dto';
import { EditarComentarioTareaPersonalDto } from './dto/editar-comentario-tarea-personal.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/**
 * "Mis Tareas" — sin `@Permissions`/`@RequiereModulo` a propósito: es
 * personal y siempre disponible para cualquier usuario autenticado
 * (mismo criterio que cambiar tu propia contraseña). La única
 * autorización real es de dueño — ver TareasPersonalesRepository, que
 * filtra por `usuarioId` en cada query.
 */
@ApiBearerAuth()
@ApiTags('tareas-personales')
@Controller('admin/mis-tareas')
export class TareasPersonalesController {
  constructor(private readonly service: TareasPersonalesService) {}

  @Post()
  crear(@Body() dto: CrearTareaPersonalDto, @CurrentUser() user: JwtPayloadUser) {
    return this.service.crear(dto, user.userId, user.tenantId);
  }

  @Get()
  listar(@CurrentUser() user: JwtPayloadUser) {
    return this.service.listar(user.userId);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.service.buscarPorId(id, user.userId);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearTareaPersonalDto>, @CurrentUser() user: JwtPayloadUser) {
    return this.service.actualizar(id, user.userId, dto);
  }

  @Delete(':id')
  eliminar(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.service.eliminar(id, user.userId);
  }

  @Post(':id/comentarios')
  agregarComentario(@Param('id') id: string, @Body() dto: CrearComentarioTareaPersonalDto, @CurrentUser() user: JwtPayloadUser) {
    return this.service.agregarComentario(id, user.userId, dto);
  }

  @Patch('comentarios/:id')
  editarComentario(@Param('id') id: string, @Body() dto: EditarComentarioTareaPersonalDto, @CurrentUser() user: JwtPayloadUser) {
    return this.service.editarComentario(id, user.userId, dto);
  }

  @Delete('comentarios/:id')
  eliminarComentario(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.service.eliminarComentario(id, user.userId);
  }
}
