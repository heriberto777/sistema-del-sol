import { ProductoTienda } from '../../hooks/useTienda';
import { TarjetaProductoTienda, DefaultsColorTienda } from './TarjetaProductoTienda';

/** Sección "Destacados" del Home (Fase 11) — no renderiza nada si el admin no marcó ningún producto. `defaults` es solo para plantillas viejas sin tokens (ver TarjetaProductoTienda). */
export function SeccionDestacados({
  productos,
  subdominio,
  defaults,
}: {
  productos: ProductoTienda[];
  subdominio: string;
  defaults?: DefaultsColorTienda;
}) {
  if (!productos.length) return null;
  return (
    <div className="px-6 pb-6 pt-2 sm:px-10">
      <h2
        className="mb-3 text-[1.05em] font-semibold"
        style={{ fontFamily: 'var(--tienda-fuente-display, inherit)', color: `var(--tienda-color-texto, ${defaults?.texto ?? 'inherit'})` }}
      >
        Destacados
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {productos.map((p) => (
          <TarjetaProductoTienda key={p.id} producto={p} subdominio={subdominio} defaults={defaults} />
        ))}
      </div>
    </div>
  );
}
