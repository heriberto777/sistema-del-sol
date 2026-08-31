import { TipoCorrelativo } from '@prisma/client';

/**
 * Catálogo de fábrica de correlativos, sembrado al provisionar un tenant
 * (ver TenantsRepository.crearConProvisioning) — una fila por tipo, todas
 * con los mismos defaults (sin prefijo, arranca en 1, 5 dígitos). El
 * admin ajusta prefijo/próximo número/dígitos por tipo después, desde
 * Admin → Consecutivos.
 */
export const CORRELATIVOS_BASE: TipoCorrelativo[] = [
  'COTIZACION',
  'REMISION',
  'ORDEN_COMPRA',
  'CAJA',
  'PRODUCTO',
  'CUENTA_CONTABLE',
  'FACTURA',
  'AJUSTE',
  'TRANSFERENCIA',
];
