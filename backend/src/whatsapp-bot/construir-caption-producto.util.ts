/**
 * Caption que acompaña la foto de un producto (bot automático y envío
 * manual del agente desde la Bandeja) — nombre+precio siempre en la
 * primera línea, categoría/descripción de marketing solo si existen (sin
 * dejar líneas vacías ni "Categoría: " sin valor).
 */
export function construirCaptionProducto(
  producto: { nombre: string; categoria?: { nombre: string } | null; descripcionTienda?: string | null },
  precio?: number | string | null,
): string {
  const lineas = [precio != null ? `${producto.nombre} — RD$ ${Number(precio).toFixed(2)}` : producto.nombre];
  if (producto.categoria?.nombre) lineas.push(`Categoría: ${producto.categoria.nombre}`);
  if (producto.descripcionTienda) lineas.push(producto.descripcionTienda);
  return lineas.join('\n');
}
