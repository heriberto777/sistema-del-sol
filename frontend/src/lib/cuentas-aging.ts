/**
 * Compartido entre Cuentas por Cobrar y Cuentas por Pagar — mismo
 * criterio de antigüedad de cartera (aging) en ambas pantallas, antes
 * duplicado carácter por carácter en cada página (auditoría de
 * estructura del frontend).
 */
export type Bucket = 'CORRIENTE' | 'D1_30' | 'D31_60' | 'D61_90' | 'D90_MAS';

export const ETIQUETA_BUCKET: Record<Bucket, string> = {
  CORRIENTE: 'Corriente',
  D1_30: '1-30 días',
  D31_60: '31-60 días',
  D61_90: '61-90 días',
  D90_MAS: '+90 días',
};

export const TONO_BUCKET: Record<Bucket, 'exito' | 'advertencia' | 'peligro'> = {
  CORRIENTE: 'exito',
  D1_30: 'advertencia',
  D31_60: 'advertencia',
  D61_90: 'peligro',
  D90_MAS: 'peligro',
};

export const fmtRD = (v: number) => `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
