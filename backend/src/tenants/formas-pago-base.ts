import { TipoFormaPago } from '@prisma/client';

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
  esPuntosLealtad?: boolean;
  tipo: TipoFormaPago;
}

export const FORMAS_PAGO_BASE: FormaPagoBase[] = [
  { nombre: 'Efectivo', requiereReferencia: false, esEfectivo: true, tipo: 'EFECTIVO' },
  { nombre: 'Tarjeta', requiereReferencia: false, esEfectivo: false, tipo: 'TARJETA' },
  { nombre: 'Transferencia', requiereReferencia: true, esEfectivo: false, tipo: 'TRANSFERENCIA' },
  { nombre: 'Crédito Cliente', requiereReferencia: false, esEfectivo: false, tipo: 'CREDITO' },
  { nombre: 'Cheque', requiereReferencia: true, esEfectivo: false, tipo: 'CHEQUE' },
  { nombre: 'Nota de Crédito', requiereReferencia: false, esEfectivo: false, tipo: 'NOTA_CREDITO' },
  // requiereReferencia: true — el código del bono se guarda en
  // PagoVenta.referencia (Fase 4c, ver BonosService.procesarPagoEnTx).
  { nombre: 'Bono', requiereReferencia: true, esEfectivo: false, esBono: true, tipo: 'BONO_VOUCHER' },
  // Ítem A-3 — sin referencia: los puntos se descuentan del cliente de LA
  // MISMA venta (dto.clienteId), no de un código independiente como Bono.
  // Existe siempre (igual criterio que Bono); LealtadService.
  // procesarPagoEnTx la rechaza si el programa no está activo.
  { nombre: 'Puntos de Lealtad', requiereReferencia: false, esEfectivo: false, esPuntosLealtad: true, tipo: 'PUNTOS_LEALTAD' },
];
