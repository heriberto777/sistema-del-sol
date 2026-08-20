/**
 * República Dominicana usa un único huso horario fijo (America/Santo_Domingo,
 * UTC-4, sin horario de verano) — pero el proceso Node puede correr en
 * cualquier zona (típicamente UTC dentro de Docker). Usado por Asistencia
 * para que la hora de marcaje sea la hora real de RD del empleado, no la
 * hora del contenedor.
 */
const ZONA_RD = 'America/Santo_Domingo';

/** Día calendario actual en RD, formato "YYYY-MM-DD". */
export function fechaHoyRD(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_RD, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** Hora actual en RD, formato "HH:MM" (24 horas). */
export function horaActualRD(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: ZONA_RD, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ahora);
}
