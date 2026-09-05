import { OfertaVisibleProducto } from '../ofertas/ofertas.service';

/**
 * Pedido explícito: el storefront muestra el precio FINAL (con ITBIS
 * incluido), como espera un comprador minorista en RD — nunca el que usan
 * Facturación/POS/checkout internamente (`Precio.precioVenta`, siempre
 * pre-impuesto). Es una transformación PURA de presentación, aplicada acá
 * DESPUÉS de que `OfertasService` ya resolvió el descuento sobre el
 * precio pre-impuesto real (`EcommerceService.adjuntarOfertas`/`producto()`)
 * — nunca se le pasa un precio con ITBIS ya sumado al motor de ofertas ni
 * a `FacturacionService`, porque este último resuelve su propio precio
 * pre-impuesto de forma completamente independiente al facturar; si el
 * preview usara un precio distinto al que ve el motor real, un descuento
 * de tipo MONTO_FIJO podría mostrar un "ahorrás" que no coincide con lo
 * que se termina cobrando. Escalar `precio`/`precioConDescuento`/`ahorro`
 * por el mismo factor DESPUÉS del cálculo es seguro para cualquier tipo
 * de oferta (porcentaje o monto fijo) porque es lineal: no cambia qué se
 * calculó, solo lo re-expresa incluyendo el impuesto.
 */
export function factorItbis(porcentajeItbis: unknown): number {
  return 1 + Number(porcentajeItbis ?? 0) / 100;
}

/**
 * `null`/`undefined` pasan tal cual — un producto sin precio de lista
 * sigue sin precio, no se inventa un "0.00". Redondea a 4 decimales
 * (mismo scale que `Precio.precioVenta`, `Decimal(14,4)`) en vez de 2 a
 * propósito: el frontend multiplica este precio unitario por la
 * cantidad en el carrito (`carrito.total`), y redondear a centavos ACÁ
 * antes de esa multiplicación arrastra hasta 1 centavo de diferencia
 * contra el total real de `FacturacionService.cotizar()` (que redondea
 * una sola vez, sobre la línea completa) apenas la cantidad es > 1 —
 * bug real, encontrado verificando esto en vivo con cantidad 2.
 * `formatearPrecio()` sigue siendo el único lugar que redondea a 2
 * decimales, para mostrar.
 */
export function precioConItbis(precio: unknown, porcentajeItbis: unknown): string | null {
  if (precio === null || precio === undefined) return null;
  return (Number(precio) * factorItbis(porcentajeItbis)).toFixed(4);
}

/** BOGO no tiene montos propios (comprarCantidad/llevarCantidad/porcentaje son cantidades y ratios, no dinero) — pasa sin tocar. */
export function ofertaConItbis(oferta: OfertaVisibleProducto | null, porcentajeItbis: unknown): OfertaVisibleProducto | null {
  if (!oferta || oferta.tipo !== 'DESCUENTO') return oferta;
  const factor = factorItbis(porcentajeItbis);
  return {
    ...oferta,
    precioConDescuento: Number((oferta.precioConDescuento * factor).toFixed(4)),
    ahorro: Number((oferta.ahorro * factor).toFixed(4)),
  };
}
