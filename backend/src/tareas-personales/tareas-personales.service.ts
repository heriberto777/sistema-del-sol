import { ForbiddenException, Injectable } from '@nestjs/common';
import { TareasPersonalesRepository } from './tareas-personales.repository';
import { CrearTareaPersonalDto } from './dto/crear-tarea-personal.dto';
import { CrearComentarioTareaPersonalDto } from './dto/crear-comentario-tarea-personal.dto';
import { EditarComentarioTareaPersonalDto } from './dto/editar-comentario-tarea-personal.dto';

@Injectable()
export class TareasPersonalesService {
  constructor(private readonly repository: TareasPersonalesRepository) {}

  crear(dto: CrearTareaPersonalDto, usuarioId: string, tenantId: string) {
    return this.repository.crear(dto, usuarioId, tenantId);
  }

  listar(usuarioId: string) {
    return this.repository.listar(usuarioId);
  }

  buscarPorId(id: string, usuarioId: string) {
    return this.repository.buscarPorId(id, usuarioId);
  }

  /**
   * `completadaEn` se deriva acá, nunca lo manda el cliente — se
   * completa sola al pasar a HECHA y se limpia si se reabre, mismo
   * criterio que cualquier timestamp derivado de un cambio de estado
   * en el resto del proyecto (ej. `comisionPagadaEn`).
   */
  async actualizar(id: string, usuarioId: string, dto: Partial<CrearTareaPersonalDto>) {
    const { fecha, estado, ...resto } = dto;
    return this.repository.actualizar(id, usuarioId, {
      ...resto,
      estado,
      ...(fecha !== undefined ? { fecha: fecha ? new Date(fecha) : null } : {}),
      ...(estado !== undefined ? { completadaEn: estado === 'HECHA' ? new Date() : null } : {}),
    });
  }

  eliminar(id: string, usuarioId: string) {
    return this.repository.eliminar(id, usuarioId);
  }

  async agregarComentario(tareaId: string, usuarioId: string, dto: CrearComentarioTareaPersonalDto) {
    await this.repository.buscarPorId(tareaId, usuarioId); // 404 si la tarea no es tuya
    return this.repository.crearComentario(tareaId, usuarioId, dto.contenido, dto.imagenes ?? []);
  }

  /**
   * ComentarioTareaPersonal no tiene tenantId/usuarioId propio — SIEMPRE
   * hay que resolver primero la tarea padre (esa sí scoped por usuario)
   * antes de confiar en nada del comentario, mismo IDOR ya documentado
   * para ComentarioTareaProyecto. Compartido entre editar/eliminar.
   */
  private async resolverComentarioPropio(comentarioId: string, usuarioId: string) {
    const comentario = await this.repository.buscarComentarioPorId(comentarioId);
    await this.repository.buscarPorId(comentario.tareaId, usuarioId); // 404 si la tarea no es tuya

    // Siempre es el mismo usuario en la práctica (una tarea personal no
    // se comparte), pero se valida igual — barato y evita depender de
    // que buscarPorId sea la única barrera si el modelo cambia mañana.
    if (comentario.autorId !== usuarioId) {
      throw new ForbiddenException('Solo podés modificar tus propios comentarios.');
    }
    return comentario;
  }

  async editarComentario(comentarioId: string, usuarioId: string, dto: EditarComentarioTareaPersonalDto) {
    await this.resolverComentarioPropio(comentarioId, usuarioId);
    return this.repository.editarComentario(comentarioId, dto.contenido);
  }

  async eliminarComentario(comentarioId: string, usuarioId: string) {
    await this.resolverComentarioPropio(comentarioId, usuarioId);
    return this.repository.eliminarComentario(comentarioId);
  }
}
