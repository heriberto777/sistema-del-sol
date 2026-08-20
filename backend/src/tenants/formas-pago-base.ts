/**
 * Catálogo de fábrica de formas de pago, sembrado al provisionar un
 * tenant (ver TenantsRepository.crearConProvisioning) — mismos 6 valores
 * que la migración `20260819040000_formas_pago` sembró para los tenants
 * ya existentes al reemplazar el enum MetodoPago.
 */
export interface FormaPagoBase {
  nombre: string;
  requiereReferencia: boolean;
  esEfectivo: boolean;
  esBono?: boolean;
}

export const FORMAS_PAGO_BASE: FormaPagoBase[] = [
  { nombre: 'Efectivo', requiereReferencia: false, esEfectivo: true },
  { nombre: 'Tarjeta', requiereReferencia: false, esEfectivo: false },
  { nombre: 'Transferencia', requiereReferencia: true, esEfectivo: false },
  { nombre: 'Crédito Cliente', requiereReferencia: false, esEfectivo: false },
  { nombre: 'Cheque', requiereReferencia: true, esEfectivo: false },
  { nombre: 'Nota de Crédito', requiereReferencia: false, esEfectivo: false },
  // requiereReferencia: true — el código del bono se guarda en
  // PagoVenta.referencia (Fase 4c, ver BonosService.procesarPagoEnTx).
  { nombre: 'Bono', requiereReferencia: true, esEfectivo: false, esBono: true },
];
