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
  // Contra-activo (Fase 4, CxC — provisión de incobrables): naturaleza
  // ACREEDORA aunque tipo sea ACTIVO, a propósito — reduce el valor neto
  // realizable de Cuentas por Cobrar en el balance, mismo criterio que
  // cualquier cuenta "de menos" (ej. depreciación acumulada).
  { codigo: '1025', nombre: 'Provisión para Cuentas Incobrables', tipo: 'ACTIVO', naturaleza: 'ACREEDORA' },
  { codigo: '1030', nombre: 'Inventario', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
  { codigo: '1040', nombre: 'ITBIS Adelantado (por Cobrar)', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
  { codigo: '2010', nombre: 'Cuentas por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' },
  { codigo: '2020', nombre: 'ITBIS por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' },
  { codigo: '2030', nombre: 'TSS e ISR por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' },
  { codigo: '2040', nombre: 'ISR Retenido a Terceros por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' },
  { codigo: '2050', nombre: 'ITBIS Retenido a Terceros por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' },
  { codigo: '3010', nombre: 'Capital Social', tipo: 'PATRIMONIO', naturaleza: 'ACREEDORA' },
  { codigo: '3020', nombre: 'Utilidades Retenidas', tipo: 'PATRIMONIO', naturaleza: 'ACREEDORA' },
  { codigo: '4010', nombre: 'Ingresos por Ventas', tipo: 'INGRESO', naturaleza: 'ACREEDORA' },
  { codigo: '5010', nombre: 'Costo de Ventas', tipo: 'GASTO', naturaleza: 'DEUDORA' },
  { codigo: '5020', nombre: 'Gastos Operativos', tipo: 'GASTO', naturaleza: 'DEUDORA' },
  { codigo: '5030', nombre: 'Gastos de Nómina', tipo: 'GASTO', naturaleza: 'DEUDORA' },
  { codigo: '5040', nombre: 'Gasto por Cuentas Incobrables', tipo: 'GASTO', naturaleza: 'DEUDORA' },
];

/**
 * Catálogo "completo" estilo PYME dominicana (benchmark 2026-11-10, Fase
 * 11.3 — Cuadre tiene un botón de un clic equivalente). Extiende
 * CUENTAS_BASE con cuentas que un tenant normalmente termina creando a
 * mano tarde o temprano (activos fijos + su depreciación acumulada,
 * anticipos, préstamos, y el desglose real de "Gastos Operativos" por
 * concepto) — nunca se mezcla con CUENTAS_BASE para no duplicar el seed
 * automático de cada tenant nuevo, se ofrece aparte vía
 * `CuentasContablesService.completarCatalogo()`, que la aplica de forma
 * idempotente (salta cualquier código que ya exista).
 *
 * `padreCodigo` referencia el `codigo` de otra fila de este mismo array
 * (o de CUENTAS_BASE) — se resuelve a `cuentaPadreId` recién al insertar,
 * nunca es el id real. El array está ordenado padre-antes-que-hijo
 * porque `completarCatalogo` resuelve el padre en el mismo recorrido
 * secuencial.
 */
export interface CuentaCatalogoCompleto extends CuentaBase {
  padreCodigo?: string;
}

export const CUENTAS_CATALOGO_COMPLETO: CuentaCatalogoCompleto[] = [
  { codigo: '1050', nombre: 'Gastos Pagados por Anticipado', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
  { codigo: '1060', nombre: 'Anticipo a Proveedores', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
  { codigo: '1070', nombre: 'Mobiliario y Equipo de Oficina', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
  // Contra-activo, mismo criterio que 1025 (Provisión para Cuentas Incobrables).
  { codigo: '1071', nombre: 'Depreciación Acumulada – Mobiliario y Equipo', tipo: 'ACTIVO', naturaleza: 'ACREEDORA', padreCodigo: '1070' },
  { codigo: '1080', nombre: 'Equipo de Computación', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
  { codigo: '1081', nombre: 'Depreciación Acumulada – Equipo de Computación', tipo: 'ACTIVO', naturaleza: 'ACREEDORA', padreCodigo: '1080' },
  { codigo: '1090', nombre: 'Vehículos', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
  { codigo: '1091', nombre: 'Depreciación Acumulada – Vehículos', tipo: 'ACTIVO', naturaleza: 'ACREEDORA', padreCodigo: '1090' },
  { codigo: '2060', nombre: 'Anticipos de Clientes', tipo: 'PASIVO', naturaleza: 'ACREEDORA' },
  { codigo: '2070', nombre: 'Préstamos por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' },
  { codigo: '2080', nombre: 'Prestaciones Laborales por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' },
  // Contra-ingreso, mismo criterio que las contra-activo de arriba.
  { codigo: '4020', nombre: 'Devoluciones y Descuentos sobre Ventas', tipo: 'INGRESO', naturaleza: 'DEUDORA' },
  { codigo: '4030', nombre: 'Otros Ingresos', tipo: 'INGRESO', naturaleza: 'ACREEDORA' },
  { codigo: '4040', nombre: 'Ingresos Financieros', tipo: 'INGRESO', naturaleza: 'ACREEDORA' },
  // Subcuentas de "Gastos Operativos" (5020, ya existe en CUENTAS_BASE) —
  // desglose real por concepto en vez de un solo cajón genérico.
  { codigo: '5021', nombre: 'Alquiler', tipo: 'GASTO', naturaleza: 'DEUDORA', padreCodigo: '5020' },
  { codigo: '5022', nombre: 'Energía Eléctrica', tipo: 'GASTO', naturaleza: 'DEUDORA', padreCodigo: '5020' },
  { codigo: '5023', nombre: 'Agua', tipo: 'GASTO', naturaleza: 'DEUDORA', padreCodigo: '5020' },
  { codigo: '5024', nombre: 'Teléfono e Internet', tipo: 'GASTO', naturaleza: 'DEUDORA', padreCodigo: '5020' },
  { codigo: '5025', nombre: 'Papelería y Útiles de Oficina', tipo: 'GASTO', naturaleza: 'DEUDORA', padreCodigo: '5020' },
  { codigo: '5026', nombre: 'Mantenimiento y Reparaciones', tipo: 'GASTO', naturaleza: 'DEUDORA', padreCodigo: '5020' },
  { codigo: '5027', nombre: 'Publicidad y Mercadeo', tipo: 'GASTO', naturaleza: 'DEUDORA', padreCodigo: '5020' },
  { codigo: '5028', nombre: 'Seguros', tipo: 'GASTO', naturaleza: 'DEUDORA', padreCodigo: '5020' },
  { codigo: '5029', nombre: 'Combustible y Lubricantes', tipo: 'GASTO', naturaleza: 'DEUDORA', padreCodigo: '5020' },
  { codigo: '5050', nombre: 'Depreciación y Amortización', tipo: 'GASTO', naturaleza: 'DEUDORA' },
  { codigo: '5060', nombre: 'Gastos Financieros', tipo: 'GASTO', naturaleza: 'DEUDORA' },
  { codigo: '5070', nombre: 'Honorarios Profesionales', tipo: 'GASTO', naturaleza: 'DEUDORA' },
  { codigo: '5080', nombre: 'Otros Gastos', tipo: 'GASTO', naturaleza: 'DEUDORA' },
];

/** Códigos que los asientos automáticos necesitan resolver por nombre conocido — ver AsientosContablesService. */
export const CODIGOS_CUENTA = {
  CAJA_BANCOS: '1010',
  CUENTAS_POR_COBRAR: '1020',
  PROVISION_CUENTAS_INCOBRABLES: '1025',
  INVENTARIO: '1030',
  ITBIS_ADELANTADO: '1040',
  CUENTAS_POR_PAGAR: '2010',
  ITBIS_POR_PAGAR: '2020',
  TSS_ISR_POR_PAGAR: '2030',
  ISR_RETENIDO_TERCEROS: '2040',
  ITBIS_RETENIDO_TERCEROS: '2050',
  INGRESOS_POR_VENTAS: '4010',
  COSTO_DE_VENTAS: '5010',
  GASTOS_DE_NOMINA: '5030',
  GASTO_CUENTAS_INCOBRABLES: '5040',
  UTILIDADES_RETENIDAS: '3020',
} as const;
