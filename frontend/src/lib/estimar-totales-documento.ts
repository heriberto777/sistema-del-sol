/**
 * % de ITBIS asumido para líneas manuales y recargos gravados cuando no
 * hay forma de conocer el real desde el cliente — mismo valor que
 * `CONFIGURACIONES_BASE.ITBIS_GENERAL` (backend/src/tenants/roles-base.ts),
 * el default con el que arranca todo tenant. Un tenant que lo haya
 * cambiado en Configuración vería un estimado levemente distinto al real
 * — aceptable, ya que esto es solo una vista previa: el monto exacto
 * siempre lo resuelve el backend al guardar.
 */
export const ITBIS_GENERAL_ESTIMADO = 18;

interface LineaParaEstimar {
  esManual: boolean;
  productoId: string;
  descripcionManual: string;
  cantidad: string;
  precioUnitario: string;
  /** Precio de lista GENERAL del producto elegido (ver SelectorLineaProducto) — usado solo si no hay `precioUnitario` explícito. */
  precioReferencia?: string | null;
  /** % de ITBIS del producto elegido (ver SelectorLineaProducto). */
  itbisReferencia?: string | number | null;
  /** Toggle de ITBIS por línea — solo existe en Facturación; ausente (Cotización) equivale a "sí aplica". */
  aplicaItbis?: boolean;
}

/**
 * Estima subtotal e ITBIS de un array de líneas — usado por los paneles
 * laterales de Factura/Cotización para mostrar un desglose financiero
 * mientras se arma el documento. Deliberadamente NO reimplementa el
 * cálculo real (ofertas automáticas, ley fiscal por producto, prorrateo
 * exacto de descuentos): el backend sigue siendo la única fuente de
 * verdad al guardar — esto es una vista previa, rotulada como tal en la UI.
 */
export function estimarLineas(lineas: LineaParaEstimar[]) {
  let subtotal = 0;
  let itbis = 0;
  for (const l of lineas) {
    const cantidad = Number(l.cantidad) || 0;
    if (l.esManual) {
      if (!l.descripcionManual.trim()) continue;
      const importe = cantidad * (Number(l.precioUnitario) || 0);
      subtotal += importe;
      itbis += importe * ((l.aplicaItbis === false ? 0 : ITBIS_GENERAL_ESTIMADO) / 100);
    } else {
      if (!l.productoId) continue;
      const precio = l.precioUnitario ? Number(l.precioUnitario) : Number(l.precioReferencia ?? 0);
      const importe = cantidad * precio;
      subtotal += importe;
      const tasa = l.aplicaItbis === false ? 0 : Number(l.itbisReferencia ?? ITBIS_GENERAL_ESTIMADO);
      itbis += importe * (tasa / 100);
    }
  }
  return { subtotal, itbis };
}
