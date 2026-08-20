import { ANTIGUEDAD_VACACIONES_18_DIAS, DIAS_PAGO_VACACIONES_POR_ANTIGUEDAD, DIAS_VACACIONES_POR_ANIO } from './nomina-config';

export interface BalanceVacaciones {
  aniosCompletos: number;
  diasAcumulados: number;
  diasDisponibles: number;
  diasPagoPorAntiguedad: number;
}

/**
 * Balance de vacaciones según el Código de Trabajo de RD (Ley 16-92,
 * Art. 177-184) — 14 días laborables por cada año de servicio CUMPLIDO
 * (meses parciales del año en curso no acumulan todavía). El balance
 * corre de por vida desde `fechaIngreso`, nunca resetea por año
 * calendario — **simplificación consciente**: no se modela vencimiento
 * anual de días no tomados (a diferencia de otros países, la ley de RD
 * no fija una caducidad explícita, pero el detalle de acumulación
 * exacta año a año queda fuera de alcance de esta fase).
 * `diasPagoPorAntiguedad` es informativo — el pago monetario especial a
 * 18 días de salario (vs. 14) para empleados con ≥5 años no se liquida
 * automáticamente en esta fase (ver ARCHITECTURE.md).
 */
export function calcularBalanceVacaciones(fechaIngreso: Date, diasYaTomados: number, ahora: Date = new Date()): BalanceVacaciones {
  const aniosCompletos = Math.max(0, diferenciaEnAniosCompletos(fechaIngreso, ahora));
  const diasAcumulados = aniosCompletos * DIAS_VACACIONES_POR_ANIO;

  return {
    aniosCompletos,
    diasAcumulados,
    diasDisponibles: diasAcumulados - diasYaTomados,
    diasPagoPorAntiguedad:
      aniosCompletos >= ANTIGUEDAD_VACACIONES_18_DIAS
        ? DIAS_PAGO_VACACIONES_POR_ANTIGUEDAD.DESDE_5_ANIOS
        : DIAS_PAGO_VACACIONES_POR_ANTIGUEDAD.MENOS_DE_5_ANIOS,
  };
}

function diferenciaEnAniosCompletos(desde: Date, hasta: Date): number {
  let anios = hasta.getUTCFullYear() - desde.getUTCFullYear();
  const aniversarioEsteAnio = new Date(Date.UTC(hasta.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate()));
  if (hasta < aniversarioEsteAnio) {
    anios -= 1;
  }
  return anios;
}

/** Cuenta los días calendario de un rango [desde, hasta] que NO sean domingo — usado para prorratear ausencias sin goce en nómina (Fase 7d). */
export function contarDiasNoDomingo(desde: Date, hasta: Date): number {
  let dias = 0;
  const cursor = new Date(desde);
  while (cursor <= hasta) {
    if (cursor.getUTCDay() !== 0) dias++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}
