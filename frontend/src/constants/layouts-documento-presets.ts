import { BloqueLayout } from '../types/layout-documento';

/**
 * Un punto de partida por cada una de las 5 PlantillaDocumento fijas —
 * aproxima su disposición visual (no pixel-exacto, el editor es para
 * ajustar desde acá) para que abrir el editor de canvas por primera vez
 * no sea una hoja en blanco. Ver documento-pdf.ts (dibujarClasico/
 * dibujarEcfOficial/etc.) para el diseño original de cada una.
 */
export const LAYOUTS_PRESET: Record<'CLASICO' | 'ECF_OFICIAL' | 'MINIMALISTA' | 'COMPACTO' | 'EDITORIAL', BloqueLayout[]> = {
  CLASICO: [
    { tipo: 'logo', x: 5, y: 4, w: 24, h: 9 },
    { tipo: 'encabezado', x: 5, y: 15, w: 60, h: 10 },
    { tipo: 'datos_cliente', x: 5, y: 26, w: 60, h: 10 },
    { tipo: 'tabla_lineas', x: 5, y: 40, w: 90, h: 32 },
    { tipo: 'totales', x: 55, y: 74, w: 40, h: 12 },
    { tipo: 'texto_legal', x: 5, y: 92, w: 90, h: 5 },
  ],
  ECF_OFICIAL: [
    { tipo: 'logo', x: 5, y: 4, w: 16, h: 8 },
    { tipo: 'datos_empresa', x: 24, y: 4, w: 32, h: 10 },
    { tipo: 'encabezado', x: 60, y: 4, w: 35, h: 10 },
    { tipo: 'datos_cliente', x: 5, y: 18, w: 90, h: 9 },
    { tipo: 'tabla_lineas', x: 5, y: 30, w: 90, h: 34 },
    { tipo: 'totales', x: 56, y: 66, w: 39, h: 12 },
    { tipo: 'firma', x: 5, y: 78, w: 28, h: 8 },
    { tipo: 'texto_legal', x: 5, y: 93, w: 90, h: 5 },
  ],
  MINIMALISTA: [
    { tipo: 'datos_empresa', x: 5, y: 4, w: 44, h: 12 },
    { tipo: 'datos_cliente', x: 51, y: 4, w: 44, h: 12 },
    { tipo: 'encabezado', x: 5, y: 19, w: 90, h: 8 },
    { tipo: 'tabla_lineas', x: 5, y: 30, w: 90, h: 36 },
    { tipo: 'totales', x: 56, y: 68, w: 39, h: 14 },
    { tipo: 'texto_legal', x: 5, y: 92, w: 90, h: 5 },
  ],
  COMPACTO: [
    { tipo: 'logo', x: 5, y: 4, w: 14, h: 7 },
    { tipo: 'datos_empresa', x: 21, y: 4, w: 40, h: 9 },
    { tipo: 'encabezado', x: 64, y: 4, w: 31, h: 8 },
    { tipo: 'datos_cliente', x: 5, y: 16, w: 90, h: 7 },
    { tipo: 'tabla_lineas', x: 5, y: 26, w: 90, h: 38 },
    { tipo: 'totales', x: 54, y: 66, w: 41, h: 16 },
    { tipo: 'texto_legal', x: 5, y: 93, w: 90, h: 5 },
  ],
  EDITORIAL: [
    { tipo: 'logo', x: 5, y: 5, w: 10, h: 7 },
    { tipo: 'datos_empresa', x: 17, y: 5, w: 38, h: 11 },
    { tipo: 'encabezado', x: 63, y: 5, w: 32, h: 11 },
    { tipo: 'datos_cliente', x: 5, y: 19, w: 60, h: 9 },
    { tipo: 'tabla_lineas', x: 5, y: 30, w: 90, h: 34 },
    { tipo: 'totales', x: 55, y: 66, w: 40, h: 13 },
    { tipo: 'texto_legal', x: 5, y: 84, w: 90, h: 10 },
  ],
};
