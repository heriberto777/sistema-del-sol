export type Categoria = 'BUG' | 'DUDA' | 'SOLICITUD' | 'OTRO';
export type Estado = 'NUEVO' | 'EN_REVISION' | 'RESUELTO';

export const ETIQUETA_CATEGORIA_SOPORTE: Record<Categoria, string> = {
  BUG: 'Algo no funciona',
  DUDA: 'Duda',
  SOLICITUD: 'Solicitud / idea',
  OTRO: 'Otro',
};
export const ETIQUETA_ESTADO_SOPORTE: Record<Estado, string> = { NUEVO: 'Enviado', EN_REVISION: 'En revisión', RESUELTO: 'Resuelto' };
export const TONO_ESTADO_SOPORTE: Record<Estado, 'neutro' | 'advertencia' | 'exito'> = { NUEVO: 'neutro', EN_REVISION: 'advertencia', RESUELTO: 'exito' };

export interface MensajeSoporte {
  id: string;
  autorTipo: 'TENANT' | 'SOPORTE';
  autorUsuario: { id: string; nombre: string } | null;
  autorAdmin: { id: string; nombre: string } | null;
  cuerpo: unknown;
  adjuntoBase64: string | null;
  adjuntoNombre: string | null;
  createdAt: string;
}

export interface TicketSoporte {
  id: string;
  asunto: string;
  categoria: Categoria;
  estado: Estado;
}
