import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearProyectoDto } from './dto/crear-proyecto.dto';
import { CrearHitoDto } from './dto/crear-hito.dto';
import { CrearTareaProyectoDto } from './dto/crear-tarea-proyecto.dto';
import { CrearRegistroHoraDto } from './dto/crear-registro-hora.dto';
import { aFecha } from './fecha-input.util';

const INCLUDE_PROYECTO = {
  cliente: { select: { id: true, nombre: true } },
  responsable: { select: { id: true, nombre: true } },
} as const;

const INCLUDE_TAREA = {
  responsables: { include: { empleado: { select: { id: true, nombre: true } } } },
  registrosHoras: { include: { empleado: { select: { id: true, nombre: true } } }, orderBy: { fecha: 'desc' as const } },
  // Fase 6 — solo las ABIERTAS (fin: null): son las que la UI necesita para
  // decidir "Iniciar" vs "Pausar" y mostrar el tiempo corriendo; las
  // cerradas ya viven como filas normales de `registrosHoras`.
  sesionesTrabajo: { where: { fin: null }, include: { empleado: { select: { id: true, nombre: true } } } },
  // Fase 8 — comentarios de equipo, orden cronológico (más viejo primero,
  // como un chat).
  comentarios: { include: { autor: { select: { id: true, nombre: true } } }, orderBy: { createdAt: 'asc' as const } },
} as const;

/**
 * Un solo repositorio para todo el plugin de Proyectos (Proyecto, Hito,
 * Tarea, responsables, registro de horas) — mismo criterio de "no
 * fragmentar de más" que `facturacion.repository.ts` con sus líneas.
 */
@Injectable()
export class ProyectosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  // ---------- Proyecto ----------

  crearProyecto(dto: CrearProyectoDto, tenantId: string) {
    return this.db.proyecto.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        clienteId: dto.clienteId,
        responsableId: dto.responsableId,
        presupuesto: dto.presupuesto,
        modoFacturacion: dto.modoFacturacion,
        tarifaHoraFacturable: dto.tarifaHoraFacturable,
        estado: dto.estado,
        fechaInicio: aFecha(dto.fechaInicio),
        fechaFinEstimada: aFecha(dto.fechaFinEstimada),
        tenantId,
      },
      include: INCLUDE_PROYECTO,
    });
  }

  listarProyectos(params: { skip: number; take: number; busqueda?: string }) {
    const where = params.busqueda ? { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } : {};
    return Promise.all([
      this.db.proyecto.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take, include: INCLUDE_PROYECTO }),
      this.db.proyecto.count({ where }),
    ]);
  }

  buscarProyectoPorId(id: string) {
    return this.db.proyecto.findUniqueOrThrow({
      where: { id },
      include: {
        ...INCLUDE_PROYECTO,
        hitos: { orderBy: { createdAt: 'asc' } },
        tareas: { include: INCLUDE_TAREA, orderBy: { createdAt: 'asc' } },
      },
    });
  }

  actualizarProyecto(id: string, dto: Partial<CrearProyectoDto>) {
    return this.db.proyecto.update({
      where: { id },
      data: {
        ...dto,
        fechaInicio: aFecha(dto.fechaInicio),
        fechaFinEstimada: aFecha(dto.fechaFinEstimada),
        // Editar el presupuesto reabre la posibilidad de un nuevo aviso de
        // "presupuesto superado" (ver PresupuestoProyectoListener).
        ...(dto.presupuesto !== undefined ? { alertaPresupuestoEnviada: false } : {}),
      },
      include: INCLUDE_PROYECTO,
    });
  }

  eliminarProyecto(id: string) {
    // Cascade en schema.prisma se encarga de hitos/tareas/registros de hora.
    return this.db.proyecto.delete({ where: { id } });
  }

  // ---------- Hito ----------

  crearHito(proyectoId: string, dto: CrearHitoDto, tenantId: string) {
    return this.db.hitoProyecto.create({ data: { ...dto, fechaObjetivo: aFecha(dto.fechaObjetivo), proyectoId, tenantId } });
  }

  buscarHitoPorId(id: string) {
    return this.db.hitoProyecto.findUniqueOrThrow({ where: { id } });
  }

  /** Fase 4 — total de horas registradas en TODAS las tareas de este hito, para facturar en modo POR_HORAS. */
  async sumarHorasDelHito(hitoId: string): Promise<number> {
    const resultado = await this.db.registroHoraProyecto.aggregate({
      where: { tarea: { hitoId } },
      _sum: { horas: true },
    });
    return Number(resultado._sum.horas ?? 0);
  }

  marcarHitoFacturado(id: string, facturaId: string) {
    return this.db.hitoProyecto.update({ where: { id }, data: { estado: 'FACTURADO', facturaId } });
  }

  /** Factura consolidada — misma Factura para varios hitos a la vez (ver comentario de `facturaId` en schema.prisma). */
  marcarHitosFacturados(hitoIds: string[], facturaId: string) {
    return this.db.hitoProyecto.updateMany({ where: { id: { in: hitoIds } }, data: { estado: 'FACTURADO', facturaId } });
  }

  /** Confirmado con el usuario — bloquea facturar un hito con tareas sin terminar. */
  contarTareasVigentesDelHito(hitoId: string): Promise<number> {
    return this.db.tareaProyecto.count({ where: { hitoId, estado: { not: 'TERMINADA' } } });
  }

  /** Fase 4 — sin ningún campo "principal" en Bodega (confirmado en schema.prisma); ordenar por nombre es lo único determinístico disponible. */
  buscarBodegaActivaPorDefecto() {
    return this.db.bodega.findFirst({ where: { activa: true }, orderBy: { nombre: 'asc' } });
  }

  actualizarHito(id: string, dto: Partial<CrearHitoDto>) {
    return this.db.hitoProyecto.update({
      where: { id },
      data: {
        ...dto,
        fechaObjetivo: aFecha(dto.fechaObjetivo),
        // Editar la fecha objetivo reabre la posibilidad de un nuevo aviso
        // de "próximo a vencer" (ver HitosProyectoCronService).
        ...(dto.fechaObjetivo !== undefined ? { alertaVencimientoEnviada: false } : {}),
      },
    });
  }

  eliminarHito(id: string) {
    return this.db.hitoProyecto.delete({ where: { id } });
  }

  // ---------- Tarea ----------

  crearTarea(proyectoId: string, dto: CrearTareaProyectoDto, tenantId: string) {
    return this.db.tareaProyecto.create({
      data: { ...dto, fechaVencimiento: aFecha(dto.fechaVencimiento), proyectoId, tenantId },
      include: INCLUDE_TAREA,
    });
  }

  buscarTareaPorId(id: string) {
    return this.db.tareaProyecto.findUniqueOrThrow({ where: { id }, include: INCLUDE_TAREA });
  }

  actualizarTarea(id: string, dto: Partial<CrearTareaProyectoDto>) {
    return this.db.tareaProyecto.update({
      where: { id },
      data: {
        ...dto,
        fechaVencimiento: aFecha(dto.fechaVencimiento),
        // Editar la fecha de vencimiento reabre la posibilidad de un nuevo
        // aviso de "vence hoy" (ver TareasProyectoCronService).
        ...(dto.fechaVencimiento !== undefined ? { recordatorioEnviado: false } : {}),
      },
      include: INCLUDE_TAREA,
    });
  }

  eliminarTarea(id: string) {
    return this.db.tareaProyecto.delete({ where: { id } });
  }

  // ---------- Sesiones de trabajo (cronómetro, Fase 6) ----------

  /** Sesión abierta de este empleado en CUALQUIER tarea — un cronómetro a la vez por empleado. */
  buscarSesionAbiertaDelEmpleado(empleadoId: string) {
    return this.db.sesionTrabajoTarea.findFirst({ where: { empleadoId, fin: null } });
  }

  /** La sesión abierta de ESTE empleado en ESTA tarea puntual (para pausarla). */
  buscarSesionAbiertaDeTareaYEmpleado(tareaId: string, empleadoId: string) {
    return this.db.sesionTrabajoTarea.findFirst({ where: { tareaId, empleadoId, fin: null } });
  }

  /** Todas las sesiones abiertas de una tarea (puede haber una por cada responsable) — para pausarlas todas al cerrar la tarea. */
  buscarSesionesAbiertasDeTarea(tareaId: string) {
    return this.db.sesionTrabajoTarea.findMany({ where: { tareaId, fin: null } });
  }

  crearSesionTrabajo(tareaId: string, empleadoId: string, tenantId: string) {
    return this.db.sesionTrabajoTarea.create({ data: { tareaId, empleadoId, tenantId } });
  }

  cerrarSesionTrabajo(id: string, fin: Date) {
    return this.db.sesionTrabajoTarea.update({ where: { id }, data: { fin } });
  }

  // ---------- Responsables de tarea ----------

  /** `upsert` sobre el `@@unique([tareaId, empleadoId])` — asignar dos veces al mismo empleado no duplica ni tira error. */
  asignarResponsable(tareaId: string, empleadoId: string) {
    return this.db.tareaProyectoResponsable.upsert({
      where: { tareaId_empleadoId: { tareaId, empleadoId } },
      create: { tareaId, empleadoId },
      update: {},
    });
  }

  quitarResponsable(tareaId: string, empleadoId: string) {
    return this.db.tareaProyectoResponsable.deleteMany({ where: { tareaId, empleadoId } });
  }

  // ---------- Registro de horas ----------

  crearRegistroHora(tareaId: string, dto: CrearRegistroHoraDto, tenantId: string) {
    return this.db.registroHoraProyecto.create({ data: { ...dto, fecha: aFecha(dto.fecha) as Date, tareaId, tenantId } });
  }

  buscarRegistroHoraPorId(id: string) {
    return this.db.registroHoraProyecto.findUniqueOrThrow({ where: { id } });
  }

  eliminarRegistroHora(id: string) {
    return this.db.registroHoraProyecto.delete({ where: { id } });
  }

  // ---------- Rentabilidad ----------

  /**
   * Facturas reales generadas desde los hitos de este proyecto (Fase 4),
   * excluyendo las ANULADAS. Usa `subtotal` (antes de ITBIS), no `total`
   * — mismo criterio que `ReportesService.reporteRentabilidad`
   * (`ventaNeta = cantidad*precioUnitario - descuento`): el ITBIS es un
   * impuesto que se cobra por cuenta de la DGII, no ingreso real, y
   * mezclarlo infla el margen en la tasa de ITBIS del tenant.
   */
  async sumarFacturadoDelProyecto(proyectoId: string): Promise<number> {
    const facturas = await this.db.factura.findMany({
      // Relación a-muchos desde que existe la factura consolidada — `some`
      // en vez de match directo (una Factura puede venir de varios hitos).
      where: { hitosProyectoOrigen: { some: { proyectoId } }, estado: { not: 'ANULADA' } },
      select: { subtotal: true },
    });
    return facturas.reduce((acc, f) => acc + Number(f.subtotal), 0);
  }

  /** Horas de TODAS las tareas del proyecto (con o sin hito), agrupadas por empleado — para costear con `costoHoraEmpleado()` de cada uno. */
  async agruparHorasDelProyectoPorEmpleado(proyectoId: string): Promise<Array<{ empleadoId: string; horas: number }>> {
    const filas = await this.db.registroHoraProyecto.groupBy({
      by: ['empleadoId'],
      where: { tarea: { proyectoId } },
      _sum: { horas: true },
    });
    return filas.map((f) => ({ empleadoId: f.empleadoId, horas: Number(f._sum.horas ?? 0) }));
  }

  /** Gastos menores asociados a este proyecto (sin concepto de anulado en GastoMenor, se suman todos). */
  async sumarGastosDelProyecto(proyectoId: string): Promise<number> {
    const resultado = await this.db.gastoMenor.aggregate({
      where: { proyectoId },
      _sum: { total: true },
    });
    return Number(resultado._sum.total ?? 0);
  }

  // ---------- Comentarios de tarea (Fase 8) ----------

  /** Liviano a propósito — para el email de aviso no hace falta traer hitos/tareas completos como sí hace `buscarProyectoPorId`. */
  buscarNombreProyecto(proyectoId: string) {
    return this.db.proyecto.findUniqueOrThrow({ where: { id: proyectoId }, select: { nombre: true } });
  }

  crearComentario(tareaId: string, autorId: string, contenido: string) {
    return this.db.comentarioTareaProyecto.create({
      data: { tareaId, autorId, contenido },
      include: { autor: { select: { id: true, nombre: true } } },
    });
  }

  buscarComentarioPorId(id: string) {
    return this.db.comentarioTareaProyecto.findUniqueOrThrow({ where: { id } });
  }

  eliminarComentario(id: string) {
    return this.db.comentarioTareaProyecto.delete({ where: { id } });
  }

  /** `User.id` de cada responsable de la tarea que tiene un Empleado vinculado a un usuario del sistema — para armar los destinatarios del aviso de "nuevo comentario" (ver `TareasProyectoService.agregarComentario`). */
  async listarUserIdsResponsablesDeTarea(tareaId: string): Promise<string[]> {
    const filas = await this.db.tareaProyectoResponsable.findMany({
      where: { tareaId },
      include: { empleado: { select: { userId: true } } },
    });
    return filas.map((f) => f.empleado.userId).filter((id): id is string => id !== null);
  }
}
