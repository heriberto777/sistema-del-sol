/**
 * Catálogo de fábrica de unidades de medida, sembrado al provisionar un
 * tenant (ver TenantsRepository.crearConProvisioning) — mismo criterio que
 * FORMAS_PAGO_BASE/CUENTAS_BASE. Un tenant puede agregar/desactivar las
 * suyas propias después desde /inventario/configuracion.
 */
export interface UnidadMedidaBase {
  codigo: string;
  nombre: string;
}

export const UNIDADES_MEDIDA_BASE: UnidadMedidaBase[] = [
  { codigo: 'UND', nombre: 'Unidad' },
  { codigo: 'CAJA', nombre: 'Caja' },
  { codigo: 'DOC', nombre: 'Docena' },
  { codigo: 'LB', nombre: 'Libra' },
  { codigo: 'KG', nombre: 'Kilogramo' },
  { codigo: 'LT', nombre: 'Litro' },
];
