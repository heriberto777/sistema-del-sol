/** Espejo de `OfertaVisibleProducto` en backend/src/ofertas/ofertas.service.ts. */
export type OfertaVisibleProducto =
  | { tipo: 'DESCUENTO'; precioConDescuento: number; ahorro: number; porcentaje: number }
  | { tipo: 'BOGO'; comprarCantidad: number; llevarCantidad: number; porcentajeDescuentoLlevar: number };

/** Texto corto para la insignia de oferta en la fila de línea (Factura/Cotización). */
export function formatearOferta(oferta: OfertaVisibleProducto): string {
  if (oferta.tipo === 'BOGO') {
    const base = `Compra ${oferta.comprarCantidad} llevate ${oferta.llevarCantidad}`;
    return oferta.porcentajeDescuentoLlevar === 100 ? base : `${base} al ${oferta.porcentajeDescuentoLlevar}%`;
  }
  return `Oferta -${oferta.porcentaje}%`;
}
