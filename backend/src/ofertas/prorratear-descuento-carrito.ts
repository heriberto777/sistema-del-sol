/**
 * Reparte un descuento de carrito (ya resuelto en RD$, ver
 * OfertasService.resolverDescuentoCarritoTotal) proporcionalmente entre
 * las líneas de la venta — necesario para que el ITBIS de cada línea seguí
 * siendo correcto (un descuento de carrito no puede aplicarse como un
 * número suelto al total sin recalcular la base imponible de cada línea).
 * Función pura, sin acceso a DB, para poder testearla sin mocks.
 *
 * Reparte en centavos y la ÚLTIMA línea absorbe el residuo exacto (en vez
 * de redondear cada línea de forma independiente) — hallazgo de auditoría:
 * sin esto, un descuento que no divide exacto entre las líneas (ej. RD$10
 * entre 3 líneas de RD$33.33) podía dejar `sum(líneas) !== descuentoTotal`
 * en uno o más centavos, descuadrando la factura contra sus propias líneas.
 */
export function prorratearDescuentoCarrito(subtotalLineas: number, montosLinea: number[], descuentoCarritoTotal: number): number[] {
  if (subtotalLineas <= 0 || descuentoCarritoTotal <= 0) return montosLinea.map(() => 0);
  const descuentoEnCentavos = Math.round(descuentoCarritoTotal * 100);
  let centavosAsignados = 0;
  return montosLinea.map((monto, indice) => {
    if (indice === montosLinea.length - 1) {
      return (descuentoEnCentavos - centavosAsignados) / 100;
    }
    const centavos = Math.round((monto / subtotalLineas) * descuentoEnCentavos);
    centavosAsignados += centavos;
    return centavos / 100;
  });
}
