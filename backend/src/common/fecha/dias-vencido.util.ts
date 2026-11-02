export const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Fecha de vencimiento = fecha del documento + plazo en días — misma fórmula que ya usaban CuentasPorCobrarService/CuentasPorPagarService/RecordatoriosService por separado; acá queda compartida para quien la necesite calcular al escribir (ver CuentaPorCobrar.fechaVencimiento). */
export function calcularFechaVencimiento(fecha: Date, plazoPagoDias: number): Date {
  return new Date(fecha.getTime() + plazoPagoDias * MS_POR_DIA);
}

/** Días vencidos a partir de una fecha de vencimiento YA resuelta — positivo = vencido, cero o negativo = por vencer. */
export function diasVencidoDesde(fechaVencimiento: Date): number {
  return Math.floor((Date.now() - fechaVencimiento.getTime()) / MS_POR_DIA);
}
