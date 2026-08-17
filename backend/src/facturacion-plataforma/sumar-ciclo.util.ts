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
