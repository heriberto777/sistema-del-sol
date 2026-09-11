export interface AutorComentarioPersonal {
  id: string;
  nombre: string;
}

export interface ComentarioTareaPersonal {
  id: string;
  contenido: string;
  imagenes: string[];
  createdAt: string;
  autor: AutorComentarioPersonal;
}

export interface TareaPersonal {
  id: string;
  titulo: string;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA';
  estado: 'PENDIENTE' | 'EN_CURSO' | 'HECHA';
  fecha: string | null;
  completadaEn: string | null;
  createdAt: string;
  updatedAt: string;
  comentarios: ComentarioTareaPersonal[];
}

export const PRIORIDADES_TAREA_PERSONAL = ['BAJA', 'MEDIA', 'ALTA'] as const;
export const ETIQUETA_PRIORIDAD_TAREA_PERSONAL: Record<string, string> = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };
export const PUNTO_PRIORIDAD_TAREA_PERSONAL: Record<string, string> = { BAJA: 'bg-slate-400', MEDIA: 'bg-blue-500', ALTA: 'bg-red-500' };

export const ESTADOS_TAREA_PERSONAL = ['PENDIENTE', 'EN_CURSO', 'HECHA'] as const;
export const ETIQUETA_ESTADO_TAREA_PERSONAL: Record<string, string> = { PENDIENTE: 'Por hacer', EN_CURSO: 'Haciendo', HECHA: 'Hecho' };

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
