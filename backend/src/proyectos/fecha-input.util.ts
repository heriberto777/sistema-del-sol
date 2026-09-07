/**
 * Los DTOs de este módulo validan fechas con `@IsDateString()` (acepta
 * "YYYY-MM-DD", el formato que manda un `<input type="date">` del
 * frontend) pero Prisma exige un `DateTime` real al crear/actualizar —
 * pasarle el string tal cual revienta con "Invalid value for argument:
 * premature end of input" (bug real encontrado al probar en vivo el
 * registro de horas). `new Date(...)` lo resuelve para "YYYY-MM-DD" y
 * para un ISO-8601 completo por igual.
 */
export function aFecha(valor: string | null | undefined): Date | null | undefined {
  if (valor === null || valor === undefined) return valor;
  return new Date(valor);
}
