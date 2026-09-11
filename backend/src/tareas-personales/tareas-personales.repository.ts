import { Injectable } from '@nestjs/common';
import { EstadoTareaPersonal, PrioridadTareaPersonal } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearTareaPersonalDto } from './dto/crear-tarea-personal.dto';

const INCLUDE_TAREA = {
  comentarios: {
    orderBy: { createdAt: 'asc' as const },
    include: { autor: { select: { id: true, nombre: true } } },
  },
};

/**
 * TODAS las queries filtran por `usuarioId` además del `tenantId` que ya
 * inyecta `TenantPrismaService` — es la única forma en que esto es
 * realmente personal (nadie ve las tareas de un compañero del mismo
 * tenant). `findFirstOrThrow`/`update`/`delete` con `{ id, usuarioId }`
 * en el `where`: si la tarea es de otro usuario, Prisma no la encuentra
 * y el filtro global de excepciones lo traduce a 404 (mismo mecanismo
 * que ya usa el aislamiento por tenant en el resto del proyecto).
 */
@Injectable()
export class TareasPersonalesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearTareaPersonalDto, usuarioId: string, tenantId: string) {
    const { fecha, ...datos } = dto;
    return this.db.tareaPersonal.create({
      data: { ...datos, usuarioId, tenantId, fecha: fecha ? new Date(fecha) : undefined },
      include: INCLUDE_TAREA,
    });
  }

  listar(usuarioId: string) {
    return this.db.tareaPersonal.findMany({
      where: { usuarioId },
      include: INCLUDE_TAREA,
      orderBy: [{ estado: 'asc' }, { fecha: 'asc' }, { createdAt: 'asc' }],
    });
  }

  buscarPorId(id: string, usuarioId: string) {
    return this.db.tareaPersonal.findFirstOrThrow({ where: { id, usuarioId }, include: INCLUDE_TAREA });
  }

  actualizar(
    id: string,
    usuarioId: string,
    datos: {
      titulo?: string;
      prioridad?: PrioridadTareaPersonal;
      estado?: EstadoTareaPersonal;
      fecha?: Date | null;
      completadaEn?: Date | null;
    },
  ) {
    return this.db.tareaPersonal.update({ where: { id, usuarioId }, data: datos, include: INCLUDE_TAREA });
  }

  eliminar(id: string, usuarioId: string) {
    return this.db.tareaPersonal.delete({ where: { id, usuarioId } });
  }

  crearComentario(tareaId: string, autorId: string, contenido: string, imagenes: string[]) {
    return this.db.comentarioTareaPersonal.create({
      data: { tareaId, autorId, contenido, imagenes },
      include: { autor: { select: { id: true, nombre: true } } },
    });
  }

  buscarComentarioPorId(id: string) {
    return this.db.comentarioTareaPersonal.findUniqueOrThrow({ where: { id } });
  }

  eliminarComentario(id: string) {
    return this.db.comentarioTareaPersonal.delete({ where: { id } });
  }
}
