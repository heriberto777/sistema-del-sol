import { CicloFacturacion } from '@prisma/client';

/**
 * `setMonth`/`setFullYear` nativos hacen rollover de año/mes solos, pero
 * `setMonth` además "rebalancea" si el día no existe en el mes destino
 * (31 ene + 1 mes = 2 mar, no 28/29 feb) — bug real encontrado en la
 * auditoría: una suscripción con `fechaProximoCorte` en 31 de un mes
 * saltaba meses enteros de facturación en cuanto cruzaba un mes corto.
 * Se evita seteando el día a 1 ANTES de sumar (nunca hay overflow al
 * sumar meses a un día-1) y recién después clampeando al día original,
 * topado al último día real del mes de destino.
 */
export function sumarCiclo(fecha: Date, ciclo: CicloFacturacion): Date {
  return sumarCiclos(fecha, ciclo, 1);
}

/** Igual que `sumarCiclo` pero N veces de una — usado por "generar factura adelantada" (pagar N meses/años de un tirón). */
export function sumarCiclos(fecha: Date, ciclo: CicloFacturacion, n: number): Date {
  const diaOriginal = fecha.getDate();
  const siguiente = new Date(fecha);
  siguiente.setDate(1);

  if (ciclo === 'ANUAL') {
    siguiente.setFullYear(siguiente.getFullYear() + n);
  } else {
    siguiente.setMonth(siguiente.getMonth() + n);
  }

  const ultimoDiaDelMesDestino = new Date(siguiente.getFullYear(), siguiente.getMonth() + 1, 0).getDate();
  siguiente.setDate(Math.min(diaOriginal, ultimoDiaDelMesDestino));
  return siguiente;
}
