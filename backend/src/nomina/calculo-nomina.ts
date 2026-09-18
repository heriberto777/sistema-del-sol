import { Prisma } from '@prisma/client';
import { TASAS_TSS, TOPES_TSS } from './nomina-config';
import { calcularIsrMensual } from './isr.util';

interface TasasTss {
  SFS_EMPLEADO: number;
  SFS_EMPLEADOR: number;
  AFP_EMPLEADO: number;
  AFP_EMPLEADOR: number;
  INFOTEP_EMPLEADOR: number;
}

interface TopesTss {
  SFS: number;
  AFP: number;
}

export interface ReciboCalculado {
  salarioBruto: number;
  sfsEmpleado: number;
  afpEmpleado: number;
  isr: number;
  otrasDeducciones: number;
  descuentoAusencias: number;
  montoHorasExtra: number;
  salarioNeto: number;
  sfsEmpleador: number;
  afpEmpleador: number;
  infotep: number;
}

/**
 * Los topes de TSS y la escala de ISR se evalúan siempre sobre el salario
 * MENSUAL (así lo hace la TSS/DGII, independientemente de la frecuencia de
 * pago) y el resultado se prorratea por `factorPeriodo` (0.5 en quincenal,
 * 1 en mensual) — nunca al revés, porque duplicar el salario quincenal
 * antes de aplicar el tope de TSS daría un resultado distinto (y
 * incorrecto) al del salario mensual real.
 */
/**
 * `descuentoAusencias` se resta SOLO en el paso final de `salarioNeto`,
 * igual que `otrasDeducciones` — nunca toca la base de TSS/ISR (que
 * sigue siendo el salario mensual completo). Decisión deliberada: cero
 * riesgo de regresión al cálculo fiscal ya en producción por una
 * feature (RRHH, Fase 7d) que no tiene nada que ver con TSS/ISR.
 */
/**
 * `tasasTss`/`topesTss` son configurables por tenant (plan de integración
 * Cuadre, ítem G-6 — ver `PeriodosNominaService.generarPeriodo`, que las
 * lee de `Configuracion` y cae a estos mismos defaults si el tenant no las
 * personalizó). El ISR (`calcularIsrMensual`) NO se hizo configurable a
 * propósito — decisión explícita, ver ARCHITECTURE.md.
 */
/**
 * `montoHorasExtra` (ya en RD$, no horas — ver
 * `PeriodosNominaService.generarPeriodo`) se SUMA al neto en el mismo punto
 * final que `descuentoAusencias`/`otrasDeducciones` se restan — no toca la
 * base de TSS/ISR. Simplificación deliberada: legalmente el pago de horas
 * extra sí suele integrar el salario cotizable de TSS en RD, pero eso
 * requiere verificación contra fuente oficial antes de nómina real (mismo
 * disclaimer que el resto de `nomina-config.ts`) — se prefirió no arriesgar
 * el cálculo de TSS/ISR ya en producción por esta feature nueva.
 */
/**
 * Auditoría de redondeo: cadena completa en Decimal (mismo criterio que
 * FacturacionService.calcularLineasYTotales) — sin ningún redondeo
 * intermedio a centavos, igual que la versión anterior en `number` (que
 * tampoco redondeaba nada hasta que Postgres persistía cada columna); lo
 * único que cambia es que la aritmética ya no acumula el error binario de
 * IEEE 754 entre la multiplicación por la tasa y el prorrateo por
 * `factorPeriodo`.
 */
export function calcularRecibo(
  salarioBrutoMensual: number,
  factorPeriodo: number,
  otrasDeducciones = 0,
  descuentoAusencias = 0,
  montoHorasExtra = 0,
  tasasTss: TasasTss = TASAS_TSS,
  topesTss: TopesTss = TOPES_TSS,
): ReciboCalculado {
  const salarioBrutoMensualD = new Prisma.Decimal(salarioBrutoMensual);
  const cotizableSfsD = salarioBrutoMensualD.lessThanOrEqualTo(topesTss.SFS) ? salarioBrutoMensualD : new Prisma.Decimal(topesTss.SFS);
  const cotizableAfpD = salarioBrutoMensualD.lessThanOrEqualTo(topesTss.AFP) ? salarioBrutoMensualD : new Prisma.Decimal(topesTss.AFP);

  const sfsEmpleadoMensualD = cotizableSfsD.times(tasasTss.SFS_EMPLEADO);
  const afpEmpleadoMensualD = cotizableAfpD.times(tasasTss.AFP_EMPLEADO);
  const sfsEmpleadorMensualD = cotizableSfsD.times(tasasTss.SFS_EMPLEADOR);
  const afpEmpleadorMensualD = cotizableAfpD.times(tasasTss.AFP_EMPLEADOR);
  const infotepMensualD = salarioBrutoMensualD.times(tasasTss.INFOTEP_EMPLEADOR);

  const cotizableIsrMensualD = salarioBrutoMensualD.minus(sfsEmpleadoMensualD).minus(afpEmpleadoMensualD);
  // calcularIsrMensual sigue en `number` de entrada/salida (también se
  // llama sola, fuera de este flujo) — ya hace su propia aritmética en
  // Decimal internamente.
  const isrMensualD = new Prisma.Decimal(calcularIsrMensual(cotizableIsrMensualD.toNumber()));

  const salarioBrutoD = salarioBrutoMensualD.times(factorPeriodo);
  const sfsEmpleadoD = sfsEmpleadoMensualD.times(factorPeriodo);
  const afpEmpleadoD = afpEmpleadoMensualD.times(factorPeriodo);
  const isrD = isrMensualD.times(factorPeriodo);
  const sfsEmpleadorD = sfsEmpleadorMensualD.times(factorPeriodo);
  const afpEmpleadorD = afpEmpleadorMensualD.times(factorPeriodo);
  const infotepD = infotepMensualD.times(factorPeriodo);

  return {
    salarioBruto: salarioBrutoD.toNumber(),
    sfsEmpleado: sfsEmpleadoD.toNumber(),
    afpEmpleado: afpEmpleadoD.toNumber(),
    isr: isrD.toNumber(),
    otrasDeducciones,
    descuentoAusencias,
    montoHorasExtra,
    salarioNeto: salarioBrutoD
      .minus(sfsEmpleadoD)
      .minus(afpEmpleadoD)
      .minus(isrD)
      .minus(otrasDeducciones)
      .minus(descuentoAusencias)
      .plus(montoHorasExtra)
      .toNumber(),
    sfsEmpleador: sfsEmpleadorD.toNumber(),
    afpEmpleador: afpEmpleadorD.toNumber(),
    infotep: infotepD.toNumber(),
  };
}
