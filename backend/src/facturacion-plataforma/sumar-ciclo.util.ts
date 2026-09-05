import { CicloFacturacion } from '@prisma/client';

/** setMonth/setFullYear nativos manejan el rollover de año/mes solos — no hace falta una librería de fechas para esto. */
export function sumarCiclo(fecha: Date, ciclo: CicloFacturacion): Date {
  const siguiente = new Date(fecha);
  if (ciclo === 'ANUAL') {
    siguiente.setFullYear(siguiente.getFullYear() + 1);
  } else {
    siguiente.setMonth(siguiente.getMonth() + 1);
  }
  return siguiente;
}

/** Igual que `sumarCiclo` pero N veces de una — usado por "generar factura adelantada" (pagar N meses/años de un tirón). */
export function sumarCiclos(fecha: Date, ciclo: CicloFacturacion, n: number): Date {
  const siguiente = new Date(fecha);
  if (ciclo === 'ANUAL') {
    siguiente.setFullYear(siguiente.getFullYear() + n);
  } else {
    siguiente.setMonth(siguiente.getMonth() + n);
  }
  return siguiente;
}
