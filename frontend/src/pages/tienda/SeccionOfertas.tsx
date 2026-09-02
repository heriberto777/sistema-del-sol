import { OfertaTienda, resumenOferta } from '../../hooks/useTienda';
import { DefaultsColorTienda } from './TarjetaProductoTienda';

/** Sección "Ofertas" del Home (Fase 11) — ofertas reales del motor ya usado en POS/Facturación, no renderiza nada sin ninguna vigente. `defaults` es solo para plantillas viejas sin tokens. */
export function SeccionOfertas({ ofertas, defaults }: { ofertas: OfertaTienda[]; defaults?: DefaultsColorTienda }) {
  if (!ofertas.length) return null;
  const acento = defaults?.acento ?? '#111827';
  const superficie = defaults?.superficie ?? '#ffffff';
  const texto = defaults?.texto ?? 'inherit';
  return (
    <div className="px-6 pb-6 sm:px-10">
      <h2 className="mb-3 text-[1.05em] font-semibold" style={{ fontFamily: 'var(--tienda-fuente-display, inherit)', color: `var(--tienda-color-texto, ${texto})` }}>
        Ofertas
      </h2>
      <div className="flex flex-wrap gap-3">
        {ofertas.map((o) => (
          <div
            key={o.id}
            className="flex flex-col gap-0.5 px-4 py-2.5"
            style={{
              borderRadius: 'var(--tienda-radio-tarjeta, 10px)',
              background: `color-mix(in srgb, var(--tienda-color-acento, ${acento}) 12%, var(--tienda-color-superficie, ${superficie}))`,
              border: `1px solid color-mix(in srgb, var(--tienda-color-acento, ${acento}) 30%, transparent)`,
            }}
          >
            <span className="text-[0.8em] font-bold" style={{ color: `var(--tienda-color-acento, ${acento})` }}>
              {resumenOferta(o)}
            </span>
            <span className="text-[0.7em]" style={{ color: `var(--tienda-color-texto, ${texto})`, opacity: 0.7 }}>
              {o.nombre}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
