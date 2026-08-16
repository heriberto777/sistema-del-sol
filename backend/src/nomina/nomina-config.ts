/**
 * Tasas de TSS (Ley 87-01) y escala de ISR (Ley 11-92 Art. 296) para
 * República Dominicana. Igual que el layout DGII 606/607/608 (ver
 * ARCHITECTURE.md), estos números se investigaron pero NO se pudieron
 * verificar contra la fuente oficial en tiempo real (resoluciones DGII/
 * TSS) — están tomados de fuentes secundarias consistentes entre sí al
 * momento de escribir esto. **Antes de procesar nómina real, verificar
 * estos valores contra la resolución DGII vigente y los topes de TSS
 * publicados ese mes** (el tope se recalcula cada vez que sube el
 * salario mínimo nacional).
 */

/** Tasas TSS — porcentaje sobre salario cotizable (con tope, ver TOPES_TSS). */
export const TASAS_TSS = {
  SFS_EMPLEADO: 0.0304,
  SFS_EMPLEADOR: 0.0709,
  AFP_EMPLEADO: 0.0287,
  AFP_EMPLEADOR: 0.071,
  INFOTEP_EMPLEADOR: 0.01,
} as const;

/** Topes mensuales de salario cotizable (RD$), por tipo de aporte. */
export const TOPES_TSS = {
  SFS: 232230,
  AFP: 464460,
} as const;

/**
 * Escala progresiva del ISR sobre renta ANUAL (RD$). `sumaFija` es lo ya
 * acumulado por los tramos anteriores; se suma al `tasa` aplicado sobre
 * el excedente de `desde`. Congelada desde 2018 (no se ajusta por
 * inflación automáticamente) — confirmar vigencia antes de usar.
 */
export const TRAMOS_ISR_ANUAL = [
  { desde: 0, hasta: 416220, tasa: 0, sumaFija: 0 },
  { desde: 416220, hasta: 624329, tasa: 0.15, sumaFija: 0 },
  { desde: 624329, hasta: 867123, tasa: 0.2, sumaFija: 31216 },
  { desde: 867123, hasta: Infinity, tasa: 0.25, sumaFija: 79776 },
] as const;
