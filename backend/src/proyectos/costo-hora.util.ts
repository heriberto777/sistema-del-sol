/**
 * Costo interno estimado de una hora de trabajo de un empleado — NO es lo
 * que se le cobra al cliente (eso es `Proyecto.tarifaHoraFacturable`, un
 * campo aparte). Se deriva del salario mensual ya cargado en Nómina, sin
 * pedir un campo nuevo (decisión explícita del usuario).
 */
export function costoHora(salarioBrutoMensual: number | string, horasLaborablesMes: number | string): number {
  const horas = Number(horasLaborablesMes);
  if (!horas) return 0;
  return Number(salarioBrutoMensual) / horas;
}
