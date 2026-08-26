import { Prisma, TipoProducto } from '@prisma/client';

/**
 * Un SERVICIO nunca mueve inventario. Un COMBO expande a sus componentes
 * físicos (cantidad de la línea × cantidad del componente) — el combo en sí
 * nunca tiene fila propia en Stock. Un componente está restringido en
 * ProductosService a PRODUCTO/SERVICIO (nunca otro COMBO), así que un solo
 * nivel de expansión alcanza, sin necesidad de recursión.
 *
 * `varianteId` (Fase 3c) es la variante YA resuelta de `productoId` — solo
 * tiene sentido para el producto vendido directamente, no para los
 * componentes de un combo (nadie elige variante por componente; cada uno
 * resuelve la suya propia — su "por defecto" si tiene una sola, o rechaza
 * si tiene varias — en `InventarioService`, ver `VariantesService.
 * resolverObligatoria`).
 *
 * Vive en `inventario/` (no en `facturacion.service.ts`, donde vivía antes)
 * porque es lógica de dominio de inventario, reusada ahora también por
 * `RemisionesService` (ítem "Remisión + stock" — "Marcar entregada" mueve
 * inventario, no solo la conversión a factura).
 */
export function expandirParaInventario(
  producto: {
    tipoProducto: TipoProducto;
    componentesCombo: Array<{ cantidad: Prisma.Decimal; componente: { id: string; tipo: TipoProducto } }>;
  },
  productoId: string,
  cantidad: number,
  varianteId?: string,
): Array<{ productoId: string; cantidad: number; varianteId?: string }> {
  if (producto.tipoProducto === 'SERVICIO') return [];
  if (producto.tipoProducto === 'COMBO') {
    return producto.componentesCombo
      .filter((c) => c.componente.tipo !== 'SERVICIO')
      .map((c) => ({ productoId: c.componente.id, cantidad: cantidad * Number(c.cantidad) }));
  }
  return [{ productoId, cantidad, varianteId }];
}
