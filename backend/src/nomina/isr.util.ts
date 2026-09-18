import { Prisma } from '@prisma/client';
import { TRAMOS_ISR_ANUAL } from './nomina-config';

/**
 * ISR mensual a retener a partir del salario cotizable ANUALIZADO (x12).
 * Ver disclaimer en nomina-config.ts.
 *
 * Auditoría de redondeo: en Decimal, no en `number` nativo — un cálculo
 * con implicación legal (Ley 11-92) no debería arrastrar el error de
 * punto flotante de IEEE 754 entre la multiplicación por 12, la resta del
 * tramo y la división final. Mismo criterio que
 * FacturacionService.calcularLineasYTotales.
 */
export function calcularIsrMensual(salarioCotizableMensual: number): number {
  const anualD = new Prisma.Decimal(salarioCotizableMensual).times(12);
  const anual = anualD.toNumber();
  const tramo = TRAMOS_ISR_ANUAL.find((t) => anual >= t.desde && anual <= t.hasta) ?? TRAMOS_ISR_ANUAL[TRAMOS_ISR_ANUAL.length - 1];
  const excedenteD = anualD.minus(tramo.desde);
  const excedentePositivoD = excedenteD.isNegative() ? new Prisma.Decimal(0) : excedenteD;
  const isrAnualD = new Prisma.Decimal(tramo.sumaFija).plus(excedentePositivoD.times(tramo.tasa));
  return isrAnualD.dividedBy(12).toNumber();
}
