/**
 * Fase 3 (CxC/CxP como ledger real) — forma plana de una línea del
 * historial de cobros/pagos de una Factura/OrdenCompra, tal como la
 * recibe el frontend (`ModalRegistrarCobro`, `ModalRegistrarPagoOrdenCompra`,
 * `FacturasTable`) ya serializada por HTTP. Reemplaza `PagoBasico`
 * (`pago-select-basico.ts`, eliminado junto con el modelo `Pago`): antes
 * era un `Prisma.PagoGetPayload` directo; ahora cada línea sale de un
 * `AplicacionCobro`/`AplicacionPago` combinado a mano con los datos de su
 * `ReciboIngreso`/`OrdenPago` (ver `PagosRepository.listarPorFactura`/
 * `.listarPorOrdenCompra`) — no hay un único modelo de Prisma del que
 * derivarla, así que se escribe literal en vez de con `SerializadoHttp`.
 */
export interface PagoHistoricoBasico {
  id: string;
  monto: string;
  fecha: string;
  referencia: string | null;
  formaPago: { nombre: string };
}
