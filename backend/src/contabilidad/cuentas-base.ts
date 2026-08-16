import { NaturalezaCuenta, TipoCuentaContable } from '@prisma/client';

// Catálogo de cuentas mínimo que se siembra en cada tenant nuevo (igual
// que PERMISOS_BASE/ROLES_BASE en tenants/roles-base.ts) — cubre lo que
// los asientos automáticos de facturación/compras necesitan de entrada.
// Un tenant puede agregar sub-cuentas propias después vía la API.
export interface CuentaBase {
  codigo: string;
  nombre: string;
  tipo: TipoCuentaContable;
  naturaleza: NaturalezaCuenta;
}

export const CUENTAS_BASE: CuentaBase[] = [
  { codigo: '1010', nombre: 'Caja y Bancos', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
  { codigo: '1020', nombre: 'Cuentas por Cobrar', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
  { codigo: '1030', nombre: 'Inventario', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
  { codigo: '1040', nombre: 'ITBIS Adelantado (por Cobrar)', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
  { codigo: '2010', nombre: 'Cuentas por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' },
  { codigo: '2020', nombre: 'ITBIS por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' },
  { codigo: '2030', nombre: 'TSS e ISR por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' },
  { codigo: '3010', nombre: 'Capital Social', tipo: 'PATRIMONIO', naturaleza: 'ACREEDORA' },
  { codigo: '3020', nombre: 'Utilidades Retenidas', tipo: 'PATRIMONIO', naturaleza: 'ACREEDORA' },
  { codigo: '4010', nombre: 'Ingresos por Ventas', tipo: 'INGRESO', naturaleza: 'ACREEDORA' },
  { codigo: '5010', nombre: 'Costo de Ventas', tipo: 'GASTO', naturaleza: 'DEUDORA' },
  { codigo: '5020', nombre: 'Gastos Operativos', tipo: 'GASTO', naturaleza: 'DEUDORA' },
  { codigo: '5030', nombre: 'Gastos de Nómina', tipo: 'GASTO', naturaleza: 'DEUDORA' },
];

/** Códigos que los asientos automáticos necesitan resolver por nombre conocido — ver AsientosContablesService. */
export const CODIGOS_CUENTA = {
  CAJA_BANCOS: '1010',
  CUENTAS_POR_COBRAR: '1020',
  INVENTARIO: '1030',
  ITBIS_ADELANTADO: '1040',
  CUENTAS_POR_PAGAR: '2010',
  ITBIS_POR_PAGAR: '2020',
  TSS_ISR_POR_PAGAR: '2030',
  INGRESOS_POR_VENTAS: '4010',
  COSTO_DE_VENTAS: '5010',
  GASTOS_DE_NOMINA: '5030',
  UTILIDADES_RETENIDAS: '3020',
} as const;
