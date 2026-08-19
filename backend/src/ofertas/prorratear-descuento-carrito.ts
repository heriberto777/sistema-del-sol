/**
 * Reparte un descuento de carrito (ya resuelto en RD$, ver
 * OfertasService.resolverDescuentoCarritoTotal) proporcionalmente entre
 * las líneas de la venta — necesario para que el ITBIS de cada línea seguí
 * siendo correcto (un descuento de carrito no puede aplicarse como un
 * número suelto al total sin recalcular la base imponible de cada línea).
 * Función pura, sin acceso a DB, para poder testearla sin mocks.
 */
export function prorratearDescuentoCarrito(subtotalLineas: number, montosLinea: number[], descuentoCarritoTotal: number): number[] {
  if (subtotalLineas <= 0 || descuentoCarritoTotal <= 0) return montosLinea.map(() => 0);
  return montosLinea.map((monto) => (monto / subtotalLineas) * descuentoCarritoTotal);
}
