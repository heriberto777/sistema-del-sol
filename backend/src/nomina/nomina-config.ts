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

/**
 * Divisor oficial del Ministerio de Trabajo de RD para el salario diario
 * (no 30 — ver ARCHITECTURE.md, sección RRHH). Usado tanto para el
 * prorrateo de ausencias sin goce de sueldo como, informativamente, para
 * el pago de vacaciones. Mismo disclaimer que el resto de este archivo:
 * no verificado contra fuente oficial en tiempo real.
 */
export const DIVISOR_SALARIO_DIARIO = 23.83;

/**
 * Qué fracción del salario BRUTO MENSUAL corresponde a un período de pago
 * (plan de integración de brechas Cuadre, ítem G-7) — ver `calcularRecibo`
 * en `calculo-nomina.ts`: los topes de TSS y la escala de ISR siempre se
 * evalúan sobre el mensual, y el resultado se prorratea por este factor,
 * nunca al revés. `SEMANAL` reusa `DIVISOR_SALARIO_DIARIO` (7 días de
 * salario diario oficial) en vez de un genérico "mes/4", porque un mes no
 * tiene exactamente 4 semanas. `BIMENSUAL` (RAE: "que se repite dos veces
 * al mes") es sinónimo de frecuencia con `QUINCENAL` — mismo factor 0.5,
 * la diferencia entre ambos es solo de nomenclatura que prefiera el
 * negocio, no de cálculo.
 */
export const FACTOR_PERIODO_NOMINA = {
  SEMANAL: 7 / DIVISOR_SALARIO_DIARIO,
  QUINCENAL: 0.5,
  BIMENSUAL: 0.5,
  MENSUAL: 1,
} as const;

/**
 * Código de Trabajo (Ley 16-92, Art. 177-184): 14 días laborables de
 * descanso por año de servicio cumplido — siempre 14, sin importar
 * antigüedad. Lo que cambia con la antigüedad es el PAGO de esos días
 * (ver `DIAS_PAGO_VACACIONES_POR_ANTIGUEDAD`), no la cantidad de días
 * libres. Mismo disclaimer: no verificado contra fuente oficial.
 */
export const DIAS_VACACIONES_POR_ANIO = 14;

/** Años de antigüedad a partir de los cuales el pago de vacaciones sube de 14 a 18 días de salario (Art. 178). */
export const ANTIGUEDAD_VACACIONES_18_DIAS = 5;
export const DIAS_PAGO_VACACIONES_POR_ANTIGUEDAD = { MENOS_DE_5_ANIOS: 14, DESDE_5_ANIOS: 18 } as const;

/**
 * Jornada ordinaria diaria (Código de Trabajo, Ley 16-92, Art. 147) — usada
 * junto a `DIVISOR_SALARIO_DIARIO` para derivar un valor por hora
 * (`salarioBrutoMensual / DIVISOR_SALARIO_DIARIO / HORAS_JORNADA_DIARIA`).
 * `RECARGO_HORAS_EXTRA` es el recargo de primera categoría (135%, Art. 203)
 * aplicado plano a toda hora extra registrada — no distingue entre las
 * primeras horas y las siguientes (que la ley paga distinto) ni horas
 * nocturnas/festivas. Mismo disclaimer que el resto de este archivo: NO
 * verificado contra fuente oficial en tiempo real — confirmar antes de
 * nómina real.
 */
export const HORAS_JORNADA_DIARIA = 8;
export const RECARGO_HORAS_EXTRA = 1.35;
