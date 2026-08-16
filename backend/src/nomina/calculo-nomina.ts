import { TASAS_TSS, TOPES_TSS } from './nomina-config';
import { calcularIsrMensual } from './isr.util';

export interface ReciboCalculado {
  salarioBruto: number;
  sfsEmpleado: number;
  afpEmpleado: number;
  isr: number;
  otrasDeducciones: number;
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
export function calcularRecibo(salarioBrutoMensual: number, factorPeriodo: number, otrasDeducciones = 0): ReciboCalculado {
  const cotizableSfs = Math.min(salarioBrutoMensual, TOPES_TSS.SFS);
  const cotizableAfp = Math.min(salarioBrutoMensual, TOPES_TSS.AFP);

  const sfsEmpleadoMensual = cotizableSfs * TASAS_TSS.SFS_EMPLEADO;
  const afpEmpleadoMensual = cotizableAfp * TASAS_TSS.AFP_EMPLEADO;
  const sfsEmpleadorMensual = cotizableSfs * TASAS_TSS.SFS_EMPLEADOR;
  const afpEmpleadorMensual = cotizableAfp * TASAS_TSS.AFP_EMPLEADOR;
  const infotepMensual = salarioBrutoMensual * TASAS_TSS.INFOTEP_EMPLEADOR;

  const cotizableIsrMensual = salarioBrutoMensual - sfsEmpleadoMensual - afpEmpleadoMensual;
  const isrMensual = calcularIsrMensual(cotizableIsrMensual);

  const salarioBruto = salarioBrutoMensual * factorPeriodo;
  const sfsEmpleado = sfsEmpleadoMensual * factorPeriodo;
  const afpEmpleado = afpEmpleadoMensual * factorPeriodo;
  const isr = isrMensual * factorPeriodo;
  const sfsEmpleador = sfsEmpleadorMensual * factorPeriodo;
  const afpEmpleador = afpEmpleadorMensual * factorPeriodo;
  const infotep = infotepMensual * factorPeriodo;

  return {
    salarioBruto,
    sfsEmpleado,
    afpEmpleado,
    isr,
    otrasDeducciones,
    salarioNeto: salarioBruto - sfsEmpleado - afpEmpleado - isr - otrasDeducciones,
    sfsEmpleador,
    afpEmpleador,
    infotep,
  };
}
