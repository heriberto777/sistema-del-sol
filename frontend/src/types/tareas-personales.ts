export interface AutorComentarioPersonal {
  id: string;
  nombre: string;
}

export interface ComentarioTareaPersonal {
  id: string;
  contenido: string;
  imagenes: string[];
  createdAt: string;
  updatedAt: string;
  autor: AutorComentarioPersonal;
}

export interface RenglonResumenIncentivo {
  id: string;
  nombre: string;
  peso: number;
  tareasTotales: number;
  tareasCompletadas: number;
  porcentaje: number;
  montoGanado: number;
}

export interface TareaPendienteIncentivo {
  id: string;
  titulo: string;
  categoriaNombre: string | null;
}

export interface ResumenIncentivo {
  periodo: string;
  renglones: RenglonResumenIncentivo[];
  pesoTotal: number;
  montoGanadoTotal: number;
  porcentajeGeneral: number;
  tareasPendientes: TareaPendienteIncentivo[];
}

export interface CategoriaIncentivo {
  id: string;
  nombre: string;
  /** Decimal serializado como string por Prisma — mismo criterio que los montos de Travel. */
  peso: string;
  activa: boolean;
  orden: number;
}

export interface TareaPersonal {
  id: string;
  titulo: string;
  descripcion: string | null;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA';
  estado: 'PENDIENTE' | 'EN_CURSO' | 'EN_ESPERA' | 'HECHA';
  fecha: string | null;
  completadaEn: string | null;
  etiquetas: string[];
  categoriaIncentivoId: string | null;
  categoriaIncentivo: CategoriaIncentivo | null;
  createdAt: string;
  updatedAt: string;
  comentarios: ComentarioTareaPersonal[];
}

export const PRIORIDADES_TAREA_PERSONAL = ['BAJA', 'MEDIA', 'ALTA'] as const;
export const ETIQUETA_PRIORIDAD_TAREA_PERSONAL: Record<string, string> = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };
export const PUNTO_PRIORIDAD_TAREA_PERSONAL: Record<string, string> = { BAJA: 'bg-slate-400', MEDIA: 'bg-blue-500', ALTA: 'bg-red-500' };

export const ESTADOS_TAREA_PERSONAL = ['PENDIENTE', 'EN_CURSO', 'EN_ESPERA', 'HECHA'] as const;
export const ETIQUETA_ESTADO_TAREA_PERSONAL: Record<string, string> = {
  PENDIENTE: 'Por hacer',
  EN_CURSO: 'Haciendo',
  EN_ESPERA: 'En espera',
  HECHA: 'Hecho',
};
/** Borde izquierdo de la tarjeta Kanban por columna — distinto del punto de prioridad, que es otro eje. */
export const COLOR_BORDE_ESTADO_TAREA_PERSONAL: Record<string, string> = {
  PENDIENTE: 'border-l-slate-400',
  EN_CURSO: 'border-l-blue-500',
  EN_ESPERA: 'border-l-amber-500',
  HECHA: 'border-l-emerald-500',
};

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Chips de arranque rápido — el campo en sí es texto libre, esto es solo para no escribir siempre lo mismo. */
export const ETIQUETAS_SUGERIDAS_NEGOCIO = ['Ventas', 'Cobros', 'Proveedores', 'Clientes', 'RRHH', 'Reportes', 'Administración'];
export const ETIQUETAS_SUGERIDAS_TECNICO = ['Bug', 'Mejora', 'Urgente', 'Investigar', 'Documentación', 'Deploy', 'Base de datos'];
