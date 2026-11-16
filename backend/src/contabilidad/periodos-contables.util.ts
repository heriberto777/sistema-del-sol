/**
 * Límites de un mes natural, en UTC — a propósito, NO en horario local.
 * `new Date(dto.fecha)` (como ya hace AsientosContablesService/
 * GastosMenoresService/PagosService/FacturasProveedorService al parsear
 * una fecha suelta tipo "2020-02-01") interpreta esa cadena como
 * medianoche UTC, nunca medianoche local — si estos límites se
 * construyeran en horario local, un asiento fechado el primer día de un
 * mes podía caer "dentro" del mes anterior (o al revés) según el huso
 * horario del servidor, dependiendo de a qué hora local cae la
 * medianoche UTC (bug real encontrado en e2e: "2020-02-01" caía todavía
 * dentro de enero, ya cerrado, en un servidor UTC-4).
 */
export function rangoDelMes(fecha: Date): { fechaInicio: Date; fechaFin: Date } {
  const fechaInicio = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
  const fechaFin = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { fechaInicio, fechaFin };
}

export function rangoDelMesSiguiente(fecha: Date): { fechaInicio: Date; fechaFin: Date } {
  const primerDiaSiguiente = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 1));
  return rangoDelMes(primerDiaSiguiente);
}
