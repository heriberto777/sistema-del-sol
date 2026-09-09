export interface Hito {
  id: string;
  nombre: string;
  fechaObjetivo: string | null;
  montoFijo: string | null;
  estado: string;
  facturaId: string | null;
}

export interface RegistroHora {
  id: string;
  empleado: { id: string; nombre: string };
  fecha: string;
  horas: string;
  nota: string | null;
}

export interface Responsable {
  empleado: { id: string; nombre: string };
}

/** Fase 6 — cronómetro. El backend solo devuelve las ABIERTAS (fin siempre null acá). */
export interface SesionTrabajo {
  id: string;
  empleadoId: string;
  empleado: { id: string; nombre: string };
  inicio: string;
}

/** Fase 8 — comentarios de equipo. Solo se puede crear/eliminar, nunca editar. */
export interface Comentario {
  id: string;
  autor: { id: string; nombre: string };
  contenido: string;
  createdAt: string;
}

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  hitoId: string | null;
  estado: string;
  prioridad: string;
  fechaVencimiento: string | null;
  responsables: Responsable[];
  registrosHoras: RegistroHora[];
  sesionesTrabajo: SesionTrabajo[];
  comentarios: Comentario[];
}

export interface ProyectoDetalleDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  cliente: { id: string; nombre: string };
  responsable: { id: string; nombre: string } | null;
  presupuesto: string | null;
  modoFacturacion: string;
  tarifaHoraFacturable: string | null;
  estado: string;
  fechaInicio: string | null;
  fechaFinEstimada: string | null;
  hitos: Hito[];
  tareas: Tarea[];
}

export interface EmpleadoOpcion {
  id: string;
  nombre: string;
}

export const ESTADOS_PROYECTO = ['PLANIFICADO', 'EN_CURSO', 'PAUSADO', 'TERMINADO', 'CANCELADO'] as const;
export const ETIQUETA_ESTADO_PROYECTO: Record<string, string> = {
  PLANIFICADO: 'Planificado',
  EN_CURSO: 'En curso',
  PAUSADO: 'Pausado',
  TERMINADO: 'Terminado',
  CANCELADO: 'Cancelado',
};

export const ESTADOS_HITO = ['PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'FACTURADO'] as const;
export const ETIQUETA_ESTADO_HITO: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  COMPLETADO: 'Completado',
  FACTURADO: 'Facturado',
};

export const ESTADOS_TAREA = ['PENDIENTE', 'EN_CURSO', 'EN_REVISION', 'TERMINADA'] as const;
export const ETIQUETA_ESTADO_TAREA: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  EN_REVISION: 'En revisión',
  TERMINADA: 'Terminada',
};

export const PRIORIDADES_TAREA = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'] as const;
export const ETIQUETA_PRIORIDAD_TAREA: Record<string, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

/** Mismas clases para insignia de prioridad en el Kanban y en cualquier otro lugar que la muestre. */
export const ESTILO_PRIORIDAD_TAREA: Record<string, string> = {
  BAJA: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  MEDIA: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
  ALTA: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  URGENTE: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300',
};
