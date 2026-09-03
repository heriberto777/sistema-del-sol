import { ProductoTienda } from '../../hooks/useTienda';
import { TarjetaProductoTienda, DefaultsColorTienda } from './TarjetaProductoTienda';
import { EstiloInsigniaOfertaTienda } from './tema';

/** "También te puede interesar" en la ficha de producto (Fase 11) — misma categoría, no renderiza nada si no hay relacionados. `defaults` es solo para plantillas viejas sin tokens (ver TarjetaProductoTienda). */
export function ProductosRelacionados({
  productos,
  subdominio,
  defaults,
  estiloInsignia = 'CLASICO',
}: {
  productos: ProductoTienda[];
  subdominio: string;
  defaults?: DefaultsColorTienda;
  estiloInsignia?: EstiloInsigniaOfertaTienda;
}) {
  if (!productos.length) return null;
  return (
    <div className="mx-auto max-w-4xl px-6 pb-16 sm:px-10">
      <h2
        className="mb-3 text-[1.05em] font-semibold"
        style={{ fontFamily: 'var(--tienda-fuente-display, inherit)', color: `var(--tienda-color-texto, ${defaults?.texto ?? 'inherit'})` }}
      >
        También te puede interesar
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {productos.map((p) => (
          <TarjetaProductoTienda key={p.id} producto={p} subdominio={subdominio} defaults={defaults} estiloInsignia={estiloInsignia} />
        ))}
      </div>
    </div>
  );
}
