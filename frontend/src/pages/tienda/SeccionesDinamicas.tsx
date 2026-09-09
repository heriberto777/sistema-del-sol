import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatearPrecio, OfertaTienda, ProductoTienda, SeccionTienda } from '../../hooks/useTienda';
import { TarjetaProductoTienda, DefaultsColorTienda } from './TarjetaProductoTienda';
import { EstiloInsigniaOfertaTienda, EstiloInsigniaSinStockTienda } from './tema';
import { SeccionDestacados } from './SeccionDestacados';
import { SeccionOfertas } from './SeccionOfertas';
import { SeccionHero } from './SeccionHero';
import { SeccionFranjaConfianza } from './SeccionFranjaConfianza';

interface PropsComunes {
  subdominio: string;
  defaults?: DefaultsColorTienda;
  estiloInsignia?: EstiloInsigniaOfertaTienda;
  estiloInsigniaSinStock?: EstiloInsigniaSinStockTienda;
}

/**
 * Home 100% administrable (Fase 18) — único punto que arma TODO el
 * contenido entre Nav y Footer, en el orden que definió el admin desde
 * "Secciones del Home". Antes de esto, cada una de las 17 plantillas
 * tenía su propio Hero hardcodeado en JSX + llamadas separadas a
 * `<SeccionDestacados>`/`<SeccionOfertas>` en posiciones fijas — ahora
 * esas 3 son secciones más (tipos HERO/DESTACADOS/OFERTAS), reordenables
 * y ocultables igual que PRODUCTOS/CATEGORIA/BANNER/MINIGRID/
 * FRANJA_CONFIANZA. `destacados`/`ofertas` siguen viniendo de sus hooks
 * de siempre (`useProductosDestacados`/`useOfertasTienda`) — DESTACADOS/
 * OFERTAS solo controlan título/orden/visibilidad, nunca reinventan esa
 * data.
 */
export function SeccionesDinamicas({
  secciones,
  destacados = [],
  ofertas = [],
  ...props
}: PropsComunes & { secciones: SeccionTienda[]; destacados?: ProductoTienda[]; ofertas?: OfertaTienda[] }) {
  if (!secciones.length) return null;
  return (
    <>
      {secciones.map((s) => {
        if (s.tipo === 'HERO') return <SeccionHero key={s.id} titulo={s.titulo} subtitulo={s.subtitulo} imagen={s.imagen} color={s.color} ctaTexto={s.ctaTexto} defaults={props.defaults} />;
        if (s.tipo === 'DESTACADOS')
          return (
            <SeccionDestacados
              key={s.id}
              productos={destacados}
              subdominio={props.subdominio}
              defaults={props.defaults}
              estiloInsignia={props.estiloInsignia}
              estiloInsigniaSinStock={props.estiloInsigniaSinStock}
              titulo={s.titulo}
            />
          );
        if (s.tipo === 'OFERTAS') return <SeccionOfertas key={s.id} ofertas={ofertas} defaults={props.defaults} titulo={s.titulo} />;
        if (s.tipo === 'FRANJA_CONFIANZA') return <SeccionFranjaConfianza key={s.id} items={s.contenido ?? []} titulo={s.titulo} defaults={props.defaults} />;
        if (s.tipo === 'PRODUCTOS') return <SeccionProductos key={s.id} seccion={s} {...props} />;
        if (s.tipo === 'BANNER') return <SeccionBanner key={s.id} seccion={s} subdominio={props.subdominio} />;
        if (s.tipo === 'CATEGORIA') return <SeccionCategoria key={s.id} seccion={s} {...props} />;
        return <SeccionMinigrid key={s.id} seccion={s} {...props} />;
      })}
    </>
  );
}

function TituloSeccion({ titulo, subtitulo, defaults }: { titulo: string; subtitulo?: string | null; defaults?: DefaultsColorTienda }) {
  const colorTexto = `var(--tienda-color-texto, ${defaults?.texto ?? 'inherit'})`;
  return (
    <div className="mb-3">
      <h2 className="text-[1.05em] font-semibold" style={{ fontFamily: 'var(--tienda-fuente-display, inherit)', color: colorTexto }}>
        {titulo}
      </h2>
      {subtitulo && (
        <p className="mt-0.5 text-xs opacity-70" style={{ color: colorTexto }}>
          {subtitulo}
        </p>
      )}
    </div>
  );
}

function SeccionProductos({
  seccion,
  subdominio,
  defaults,
  estiloInsignia = 'CLASICO',
  estiloInsigniaSinStock = 'ETIQUETA',
}: PropsComunes & { seccion: SeccionTienda }) {
  if (!seccion.productos.length) return null;
  return (
    <div className="px-6 pb-6 pt-2 sm:px-10">
      <TituloSeccion titulo={seccion.titulo} subtitulo={seccion.subtitulo} defaults={defaults} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {seccion.productos.map((p) => (
          <TarjetaProductoTienda
            key={p.id}
            producto={p}
            subdominio={subdominio}
            defaults={defaults}
            estiloInsignia={estiloInsignia}
            estiloInsigniaSinStock={estiloInsigniaSinStock}
          />
        ))}
      </div>
    </div>
  );
}

/** Slideshow de productos elegidos a mano — reemplaza el banner estático de imagen fija (pedido explícito: "que pueda marcar cuando esté creando que lo asigne en banner, para que se muestre tipo slide y cuando dé clic se direccione al detalle de producto"). */
function SeccionBanner({ seccion, subdominio }: { seccion: SeccionTienda; subdominio: string }) {
  const [indice, setIndice] = useState(0);
  const productos = seccion.productos;

  useEffect(() => {
    if (productos.length < 2) return;
    const id = setInterval(() => setIndice((i) => (i + 1) % productos.length), 5000);
    return () => clearInterval(id);
  }, [productos.length]);

  if (!productos.length) return null;
  const producto = productos[Math.min(indice, productos.length - 1)];

  return (
    <div className="px-6 pb-6 pt-2 sm:px-10">
      <Link
        to={`/tienda/${subdominio}/producto/${producto.id}`}
        className="relative flex h-48 items-end overflow-hidden rounded-2xl sm:h-64"
        style={{ background: 'var(--tienda-color-acento, #111827)' }}
      >
        {producto.imagen && <img src={producto.imagen} alt={producto.nombre} className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="relative z-10 p-5 text-white">
          <p className="text-xs uppercase tracking-wide opacity-80">{seccion.titulo}</p>
          <h2 className="text-lg font-semibold sm:text-2xl">{producto.nombre}</h2>
          {producto.precio && <p className="mt-1 text-sm opacity-90">{formatearPrecio(producto.precio)}</p>}
        </div>
        {productos.length > 1 && (
          <div className="absolute bottom-3 right-4 z-10 flex gap-1.5">
            {productos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setIndice(i);
                }}
                aria-label={`Ir al slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === indice ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}

/** Clic va a la página dedicada de categoría (Fase 18) — no filtra el Home in-place: una categoría con hero/Destacados/Ofertas/otras secciones arriba se sentía "demasiado llena" (pedido explícito del usuario, mismo patrón que amazon.com al entrar a una categoría). */
function SeccionCategoria({ seccion, subdominio, defaults }: PropsComunes & { seccion: SeccionTienda }) {
  const navigate = useNavigate();
  if (!seccion.categoria) return null;
  const categoria = seccion.categoria;
  return (
    <div className="px-6 pb-6 pt-2 sm:px-10">
      <button
        type="button"
        onClick={() => navigate(`/tienda/${subdominio}/categoria/${categoria.id}`)}
        className="relative flex h-40 w-full items-end overflow-hidden rounded-2xl text-left sm:h-48"
        style={{ background: `var(--tienda-color-acento, ${defaults?.acento ?? '#111827'})` }}
      >
        {seccion.imagen && <img src={seccion.imagen} alt={seccion.titulo} className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="relative z-10 p-5 text-white">
          <h2 className="text-lg font-semibold sm:text-xl">{seccion.titulo}</h2>
          {seccion.subtitulo && <p className="text-sm opacity-90">{seccion.subtitulo}</p>}
          <span className="mt-2 inline-block text-xs font-semibold underline underline-offset-2">{seccion.ctaTexto || `Ver ${categoria.nombre}`}</span>
        </div>
      </button>
    </div>
  );
}

const COLUMNAS_MINIGRID: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
};

function SeccionMinigrid({ seccion, subdominio, defaults }: PropsComunes & { seccion: SeccionTienda }) {
  const navigate = useNavigate();
  if (seccion.categorias.length < 2) return null;
  return (
    <div className="px-6 pb-6 pt-2 sm:px-10">
      <TituloSeccion titulo={seccion.titulo} subtitulo={seccion.subtitulo} defaults={defaults} />
      <div className={`grid gap-3 ${COLUMNAS_MINIGRID[seccion.categorias.length] ?? 'grid-cols-2'}`}>
        {seccion.categorias.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => navigate(`/tienda/${subdominio}/categoria/${c.id}`)}
            className="relative flex h-24 items-end overflow-hidden rounded-xl p-3 text-left text-sm font-semibold text-white sm:h-32"
            style={{ background: `linear-gradient(135deg, hsl(${i * 70}, 60%, 55%), hsl(${i * 70 + 40}, 60%, 40%))` }}
          >
            {c.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
