import { TRAMOS_ISR_ANUAL } from './nomina-config';

/** ISR mensual a retener a partir del salario cotizable ANUALIZADO (x12). Ver disclaimer en nomina-config.ts. */
export function calcularIsrMensual(salarioCotizableMensual: number): number {
  const anual = salarioCotizableMensual * 12;
  const tramo = TRAMOS_ISR_ANUAL.find((t) => anual >= t.desde && anual <= t.hasta) ?? TRAMOS_ISR_ANUAL[TRAMOS_ISR_ANUAL.length - 1];
  const excedente = Math.max(0, anual - tramo.desde);
  const isrAnual = tramo.sumaFija + excedente * tramo.tasa;
  return isrAnual / 12;
}
