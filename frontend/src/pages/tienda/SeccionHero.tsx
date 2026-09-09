import { DefaultsColorTienda } from './TarjetaProductoTienda';

/**
 * Home 100% dinámico (Fase 18) — reemplaza el bloque de bienvenida que
 * antes estaba hardcodeado en el JSX de cada una de las 17 plantillas
 * (texto/copy propio de cada una, imposible de tocar desde el admin).
 * Ahora es una sección más de "Secciones del Home": título/subtítulo/
 * imagen de fondo/color, editable y reordenable como cualquier otra.
 */
export function SeccionHero({
  titulo,
  subtitulo,
  imagen,
  color,
  ctaTexto,
  defaults,
}: {
  titulo: string;
  subtitulo?: string | null;
  imagen?: string | null;
  color?: string | null;
  ctaTexto?: string | null;
  defaults?: DefaultsColorTienda;
}) {
  const colorTexto = imagen ? '#fff' : `var(--tienda-color-texto, ${defaults?.texto ?? 'inherit'})`;
  const fondo = imagen
    ? undefined
    : color || `var(--tienda-color-superficie, ${defaults?.superficie ?? 'transparent'})`;

  return (
    <div
      className="relative flex flex-col justify-end gap-2 overflow-hidden px-6 py-10 sm:px-10 sm:py-14"
      style={{ background: fondo, minHeight: imagen ? '14rem' : undefined }}
    >
      {imagen && (
        <>
          <img src={imagen} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </>
      )}
      <div className="relative z-10 max-w-md">
        <h1
          className="text-[1.7em] font-bold"
          style={{ fontFamily: 'var(--tienda-fuente-display)', color: colorTexto }}
        >
          {titulo}
        </h1>
        {subtitulo && (
          <p className="mt-1 text-[0.85em] opacity-80" style={{ color: colorTexto }}>
            {subtitulo}
          </p>
        )}
        {ctaTexto && (
          <span
            className="mt-3 inline-block text-[0.72em] font-semibold uppercase tracking-[0.08em]"
            style={{ color: colorTexto, opacity: 0.85 }}
          >
            {ctaTexto}
          </span>
        )}
      </div>
    </div>
  );
}
