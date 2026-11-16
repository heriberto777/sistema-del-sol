/**
 * Límites de un mes natural — `fechaInicio` al día 1 (medianoche),
 * `fechaFin` al último día a las 23:59:59.999 (para que los movimientos
 * del propio último día del mes queden incluidos en el rango, mismo
 * criterio que ya usaba `finDelDia` en CierrePeriodoService).
 */
export function rangoDelMes(fecha: Date): { fechaInicio: Date; fechaFin: Date } {
  const fechaInicio = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const fechaFin = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59, 999);
  return { fechaInicio, fechaFin };
}

export function rangoDelMesSiguiente(fecha: Date): { fechaInicio: Date; fechaFin: Date } {
  const primerDiaSiguiente = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1);
  return rangoDelMes(primerDiaSiguiente);
}
