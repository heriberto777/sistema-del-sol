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

export interface TareaPersonal {
  id: string;
  titulo: string;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA';
  estado: 'PENDIENTE' | 'EN_CURSO' | 'EN_ESPERA' | 'HECHA';
  fecha: string | null;
  completadaEn: string | null;
  etiquetas: string[];
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

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Chips de arranque rápido — el campo en sí es texto libre, esto es solo para no escribir siempre lo mismo. */
export const ETIQUETAS_SUGERIDAS_NEGOCIO = ['Ventas', 'Cobros', 'Proveedores', 'Clientes', 'RRHH', 'Reportes', 'Administración'];
export const ETIQUETAS_SUGERIDAS_TECNICO = ['Bug', 'Mejora', 'Urgente', 'Investigar', 'Documentación', 'Deploy', 'Base de datos'];
