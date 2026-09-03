import { badgeCortoOferta, formatearPrecio, lineaOferta, OfertaVisibleProducto } from '../../hooks/useTienda';
import { EstiloInsigniaOfertaTienda } from './tema';

/**
 * Insignia + fila de precio de una oferta en la tarjeta de producto (Fase
 * 13) — reemplaza la sección "Ofertas" separada por el modelo Amazon de
 * mostrarlo directo sobre el producto. Un solo lugar para los 3 estilos
 * elegibles en Personalización, reusado por `TarjetaProductoTienda` (Destacados/
 * Relacionados) y por la grilla de catálogo propia de cada una de las 17
 * plantillas — así ninguna tiene que reimplementar el criterio visual.
 * `colorAcento`/`colorSuperficie` son el respaldo para las 3 plantillas
 * viejas sin tokens (mismo criterio que `DefaultsColorTienda` en
 * `TarjetaProductoTienda`) — solo Boutique (oscura) los necesita de
 * verdad, Directo/Mercado (claras) funcionan bien con el default.
 * `inline-flex` (no `flex`) en los envoltorios para poder centrarse
 * correctamente dentro de tarjetas de layout centrado (Boutique/Atelier/etc.).
 */
export function InsigniaOferta({
  oferta,
  estilo,
  colorAcento,
  colorSuperficie,
}: {
  oferta: OfertaVisibleProducto | null;
  estilo: EstiloInsigniaOfertaTienda;
  colorAcento?: string;
  colorSuperficie?: string;
}) {
  if (!oferta) return null;
  const texto = estilo === 'AHORRO' ? 'Oferta' : badgeCortoOferta(oferta);
  const acento = `var(--tienda-color-acento, ${colorAcento ?? '#111827'})`;
  if (estilo === 'CINTA') {
    return (
      <span className="absolute left-0 top-3 rounded-r-md py-1 pl-2.5 pr-3 text-[0.62em] font-extrabold text-white" style={{ background: acento }}>
        {texto}
      </span>
    );
  }
  if (estilo === 'AHORRO') {
    return (
      <span
        className="absolute left-2 top-2 rounded-md border px-2 py-0.5 text-[0.6em] font-bold"
        style={{ borderColor: acento, color: acento, background: `var(--tienda-color-superficie, ${colorSuperficie ?? '#fff'})` }}
      >
        {texto}
      </span>
    );
  }
  return (
    <span className="absolute left-2 top-2 rounded-md px-2 py-0.5 text-[0.62em] font-extrabold text-white" style={{ background: acento }}>
      {texto}
    </span>
  );
}

/** Precio "final" a mandar al carrito — el descuento ya resuelto por el backend cuando aplica, nunca el de lista. BOGO no tiene un precio unitario real, sigue usando el de lista (el checkout revalida la mecánica real). */
export function precioParaCarrito(precio: string | number | null, oferta: OfertaVisibleProducto | null): number {
  if (oferta?.tipo === 'DESCUENTO') return oferta.precioConDescuento;
  return Number(precio ?? 0);
}

/** Precio de lista a guardar junto al ítem del carrito SOLO cuando hay descuento real (para mostrarlo tachado ahí) — `undefined` en cualquier otro caso, nunca un "precio original" igual al final. */
export function precioOriginalParaCarrito(precio: string | number | null, oferta: OfertaVisibleProducto | null): number | undefined {
  return oferta?.tipo === 'DESCUENTO' ? Number(precio ?? 0) : undefined;
}

export function FilaPrecioOferta({
  precio,
  oferta,
  estilo,
  tamano = '0.8em',
  colorAcento,
}: {
  precio: string | number | null;
  oferta: OfertaVisibleProducto | null;
  estilo: EstiloInsigniaOfertaTienda;
  tamano?: string;
  colorAcento?: string;
}) {
  const acento = `var(--tienda-color-acento, ${colorAcento ?? '#111827'})`;
  if (!oferta) {
    return (
      <span className="font-bold" style={{ fontSize: tamano, color: acento }}>
        {formatearPrecio(precio)}
      </span>
    );
  }
  const mostrarLinea = estilo !== 'CINTA';
  if (oferta.tipo === 'BOGO') {
    return (
      <span className="inline-flex flex-col">
        <span className="font-bold" style={{ fontSize: tamano, color: acento }}>
          {formatearPrecio(precio)}
        </span>
        {mostrarLinea && (
          <span className="font-semibold" style={{ fontSize: '0.62em', color: acento }}>
            {lineaOferta(oferta, estilo === 'AHORRO')}
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-baseline gap-1.5">
        <span className="font-bold" style={{ fontSize: tamano, color: acento }}>
          {formatearPrecio(oferta.precioConDescuento)}
        </span>
        <span className="opacity-50 line-through" style={{ fontSize: '0.84em' }}>
          {formatearPrecio(precio)}
        </span>
      </span>
      {mostrarLinea && (
        <span className="font-semibold" style={{ fontSize: '0.62em', color: acento }}>
          {lineaOferta(oferta, estilo === 'AHORRO')}
        </span>
      )}
    </span>
  );
}
