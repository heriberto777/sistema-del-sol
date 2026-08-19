/**
 * Catálogo de fábrica de niveles de precio, sembrado al provisionar un
 * tenant (ver TenantsRepository.crearConProvisioning) — mismos 4 valores
 * que la migración `20260819090000_listas_precio` sembró para los tenants
 * ya existentes. "GENERAL" en mayúsculas a propósito: calza exacto con el
 * default histórico de `Precio.listaPrecio`.
 */
export interface ListaPrecioBase {
  nombre: string;
}

export const LISTAS_PRECIO_BASE: ListaPrecioBase[] = [
  { nombre: 'GENERAL' },
  { nombre: 'Mayorista' },
  { nombre: 'Distribuidor' },
  { nombre: 'Especial' },
];
