import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Search, ShoppingCart, Trash2, User } from 'lucide-react';
import { formatearPrecio, useOfertasTienda, useProductosDestacados, useSeccionesTienda } from '../../../hooks/useTienda';
import { useClienteTienda } from '../../../hooks/useClienteTienda';
import { useCarritoDrawer } from '../CarritoDrawerContext';
import { BannerAnuncio } from '../BannerAnuncio';
import { SeccionDestacados } from '../SeccionDestacados';
import { SeccionOfertas } from '../SeccionOfertas';
import { SeccionesDinamicas } from '../SeccionesDinamicas';
import { ProductosRelacionados } from '../ProductosRelacionados';
import { FilaPrecioOferta, InsigniaOferta, precioOriginalParaCarrito, precioParaCarrito } from '../OfertaEnTarjeta';
import { claseImagenSinStock, EtiquetaSinExistenciaVariante, InsigniaSinStock, TextoSinStock } from '../InsigniaSinStock';
import { ClaveMenuTienda, DefaultsTemaPlantilla, menuVisibleOrdenado, useCargarFuentesTienda, variablesCssTema } from '../tema';
import type { Plantilla, PropsCarrito, PropsHome, PropsProducto } from './tipos';

// Fase 7 — Belleza/cosmética, insp. Glossier: rosa suave, serif elegante,
// minimalismo comunitario. Aprobada en mockup previo a esta implementación.
const DEFAULTS: DefaultsTemaPlantilla = {
  colorAcento: '#c66b78',
  colorFondo: '#faf3f0',
  colorSuperficie: '#ffffff',
  colorTexto: '#3a2c2f',
  fuenteDisplay: 'Bodoni Moda',
  fuenteBody: 'Nunito Sans',
};

const ENLACES_MENU: Record<ClaveMenuTienda, { label: string; href: (subdominio: string) => string }> = {
  inicio: { label: 'Inicio', href: (s) => `/tienda/${s}` },
  categorias: { label: 'Categorías', href: (s) => `/tienda/${s}#catalogo` },
  carrito: { label: 'Bolsa', href: (s) => `/tienda/${s}/carrito` },
  cuenta: { label: 'Mi cuenta', href: (s) => `/tienda/${s}/mis-pedidos` },
};

function Nav({
  nombre,
  logo,
  subdominio,
  cantidadCarrito,
  menu,
}: {
  nombre: string;
  logo: string | null;
  subdominio: string;
  cantidadCarrito: number;
  menu: ClaveMenuTienda[];
}) {
  const { autenticado } = useClienteTienda(subdominio);
  const { abrir } = useCarritoDrawer();
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--tienda-color-acento)]/15 px-6 py-4 sm:px-10">
      <Link to={`/tienda/${subdominio}`} className="flex items-center gap-2" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
        {logo && <img src={logo} alt={nombre} className="h-8 w-8 rounded-full object-cover" />}
        <span className="text-lg font-semibold text-[var(--tienda-color-texto)]">{nombre}</span>
      </Link>
      <div className="flex items-center gap-5">
        {menu.map((clave) => {
          if (clave === 'carrito') {
            return (
              <button key={clave} type="button" onClick={abrir} className="flex items-center gap-2 text-sm font-semibold text-[var(--tienda-color-texto)]">
                <ShoppingCart size={17} />
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: 'var(--tienda-color-acento)' }}>
                  {cantidadCarrito}
                </span>
              </button>
            );
          }
          if (clave === 'cuenta') {
            return (
              <Link
                key={clave}
                to={autenticado ? ENLACES_MENU.cuenta.href(subdominio) : `/tienda/${subdominio}/login`}
                className="flex items-center gap-1.5 text-sm font-semibold text-[var(--tienda-color-texto)]"
              >
                <User size={15} />
                {autenticado ? 'Mi cuenta' : 'Iniciar sesión'}
              </Link>
            );
          }
          return (
            <Link key={clave} to={ENLACES_MENU[clave].href(subdominio)} className="text-sm font-semibold text-[var(--tienda-color-texto)]">
              {ENLACES_MENU[clave].label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Footer({ nombre }: { nombre: string }) {
  return (
    <div className="flex justify-between border-t border-[color:var(--tienda-color-acento)]/15 px-6 py-6 text-xs opacity-60 sm:px-10">
      <span>© {nombre}</span>
      <span>Powered by Sistema del Sol</span>
    </div>
  );
}

function ThumbBruma({ imagen, nombre }: { imagen: string | null; nombre: string }) {
  return (
    <div
      className="w-full overflow-hidden rounded-[var(--tienda-radio-tarjeta)]"
      style={{ aspectRatio: 'var(--tienda-ratio-imagen)', background: 'color-mix(in srgb, var(--tienda-color-acento) 30%, var(--tienda-color-superficie))' }}
    >
      {imagen && <img src={imagen} alt={nombre} className="h-full w-full object-cover" />}
    </div>
  );
}

function BrumaHome({ config, subdominio, carrito, productos, cargando, busqueda, onBuscar }: PropsHome) {
  const { tema, nombre, logo } = config;
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  const { data: destacados = [] } = useProductosDestacados(subdominio);
  const { data: ofertas = [] } = useOfertasTienda(subdominio);
  const { data: secciones = [] } = useSeccionesTienda(subdominio);
  return (
    <div
      className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]"
      style={{ ...variablesCssTema(tema, DEFAULTS), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}
    >
      <BannerAnuncio mensajes={config.bannerAnuncio.mensajes} intervaloSegundos={config.bannerAnuncio.intervaloSegundos} />
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />

      <div className="px-6 pb-8 pt-14 text-center sm:px-10">
        <div className="mb-3 text-[0.7em] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--tienda-color-acento)' }}>
          Edición cápsula
        </div>
        <h1 className="mx-auto mb-3 max-w-lg text-[1.9em] font-semibold leading-tight" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          {nombre}
        </h1>
        <p className="mx-auto max-w-md text-[0.85em] leading-relaxed opacity-70">Fórmulas simples, empaques honestos — pensado para vos.</p>
      </div>

      <SeccionDestacados productos={destacados} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} estiloInsigniaSinStock={tema.estiloInsigniaSinStock} />
      <SeccionOfertas ofertas={ofertas} mostrar={tema.mostrarSeccionOfertas} />
      <SeccionesDinamicas secciones={secciones} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} estiloInsigniaSinStock={tema.estiloInsigniaSinStock} />

      <div id="catalogo" className="flex items-baseline justify-between px-6 pb-4 pt-4 sm:px-10">
        <h2 className="text-[1.05em] font-semibold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          Productos
        </h2>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar producto…"
            className="rounded-full border border-[color:var(--tienda-color-acento)]/25 bg-[var(--tienda-color-superficie)] py-2 pl-8 pr-3 text-[0.8em] outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 pb-16 sm:grid-cols-3 sm:px-10 lg:grid-cols-4">
        {cargando && <p className="col-span-full text-[0.85em] opacity-60">Cargando…</p>}
        {!cargando && productos.length === 0 && <p className="col-span-full text-[0.85em] opacity-60">No hay productos.</p>}
        {productos.map((p) => (
          <Link
            key={p.id}
            to={`/tienda/${subdominio}/producto/${p.id}`}
            className="overflow-hidden rounded-[var(--tienda-radio-tarjeta)] bg-[var(--tienda-color-superficie)] shadow-[var(--tienda-sombra-tarjeta)] text-center"
          >
            <div className={`relative ${claseImagenSinStock(p.sinStock, tema.estiloInsigniaSinStock)}`}>
              <ThumbBruma imagen={p.imagen} nombre={p.nombre} />
              {p.sinStock ? (
                <InsigniaSinStock sinStock estilo={tema.estiloInsigniaSinStock} />
              ) : (
                <InsigniaOferta oferta={p.oferta} estilo={tema.estiloInsigniaOferta} />
              )}
            </div>
            <div className="p-3">
              <h3 className="mb-1.5 text-[0.85em] font-bold">{p.nombre}</h3>
              <div className="flex items-center justify-center gap-2">
                {p.oferta && !p.sinStock ? (
                  <FilaPrecioOferta precio={p.precio} oferta={p.oferta} estilo={tema.estiloInsigniaOferta} tamano="0.8em" />
                ) : (
                  <span className="text-[0.8em] font-bold" style={{ color: 'var(--tienda-color-acento)' }}>
                    {formatearPrecio(p.precio)}
                  </span>
                )}
                <TextoSinStock sinStock={p.sinStock} estilo={tema.estiloInsigniaSinStock} />
                {!p.tieneVariantes && p.varianteId && !p.sinStock && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      carrito.agregar({ productoId: p.id, varianteId: p.varianteId!, varianteEtiqueta: '', nombre: p.nombre, precio: precioParaCarrito(p.precio, p.oferta), precioOriginal: precioOriginalParaCarrito(p.precio, p.oferta), imagen: p.imagen });
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: 'var(--tienda-color-acento)' }}
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Footer nombre={nombre} />
    </div>
  );
}

function BrumaProducto({ config, subdominio, carrito, producto, varianteSeleccionada, onSeleccionarVariante, cantidad, onCantidadChange, onAgregar }: PropsProducto) {
  const { tema, nombre, logo } = config;
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  const debeElegirVariante = producto.variantes.length > 1;
  const galeria = [producto.imagen, ...producto.imagenesAdicionales].filter((img): img is string => !!img);
  const [imagenActiva, setImagenActiva] = useState(galeria[0] ?? null);
  return (
    <div
      className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]"
      style={{ ...variablesCssTema(tema, DEFAULTS), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}
    >
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="mx-auto grid max-w-4xl gap-10 px-6 py-12 sm:grid-cols-2 sm:px-10">
        <div>
          <div className="overflow-hidden rounded-[var(--tienda-radio-tarjeta)]" style={{ aspectRatio: 'var(--tienda-ratio-imagen)' }}>
            <ThumbBruma imagen={imagenActiva} nombre={producto.nombre} />
          </div>
          {galeria.length > 1 && (
            <div className="mt-3 flex gap-2">
              {galeria.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImagenActiva(img)}
                  className="h-14 w-14 overflow-hidden rounded-full border-2"
                  style={{ borderColor: imagenActiva === img ? 'var(--tienda-color-acento)' : 'transparent' }}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="mb-2 text-[1.5em] font-semibold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
            {producto.nombre}
          </h1>
          <div className="mb-4" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
            {varianteSeleccionada ? (
              <FilaPrecioOferta precio={varianteSeleccionada.precio} oferta={varianteSeleccionada.oferta} estilo={tema.estiloInsigniaOferta} tamano="1.4em" />
            ) : (
              <p className="text-[1.4em] font-bold" style={{ color: 'var(--tienda-color-acento)' }}>Elegí una opción</p>
            )}
          </div>
          {producto.descripcionTienda && <p className="mb-5 text-[0.85em] leading-relaxed opacity-70">{producto.descripcionTienda}</p>}

          {debeElegirVariante && (
            <div className="mb-5 flex flex-col gap-2">
              {producto.variantes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSeleccionarVariante(v.id)}
                  disabled={v.stock !== null && v.stock <= 0}
                  className="flex items-center justify-between rounded-[var(--tienda-radio-tarjeta)] border px-3 py-2 text-left text-[0.85em] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: varianteSeleccionada?.id === v.id ? 'var(--tienda-color-acento)' : 'color-mix(in srgb, var(--tienda-color-texto) 15%, transparent)' }}
                >
                  <span className="flex flex-col">
                    <span>{v.etiqueta || '(sin atributos)'}</span>
                    {v.stock !== null &&
                      (v.stock > 0 ? (
                        <span className="text-[0.75em] opacity-60">{v.stock} disponibles</span>
                      ) : (
                        <EtiquetaSinExistenciaVariante estilo={tema.estiloInsigniaSinStock} />
                      ))}
                  </span>
                  <span className="font-bold" style={{ color: 'var(--tienda-color-acento)' }}>
                    {formatearPrecio(v.precio)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {varianteSeleccionada && varianteSeleccionada.stock !== null && (
            <p className="mb-6 text-[0.85em] opacity-60">
              {varianteSeleccionada.stock > 0 ? `${varianteSeleccionada.stock} disponibles` : <EtiquetaSinExistenciaVariante estilo={tema.estiloInsigniaSinStock} />}
            </p>
          )}
          <div className="mb-5 flex items-center gap-3">
            <button type="button" onClick={() => onCantidadChange(Math.max(1, cantidad - 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--tienda-color-texto)]/15">
              <Minus size={14} />
            </button>
            <span className="w-6 text-center font-semibold">{cantidad}</span>
            <button type="button" onClick={() => onCantidadChange(cantidad + 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--tienda-color-texto)]/15">
              <Plus size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={onAgregar}
            disabled={!varianteSeleccionada}
            className="rounded-full px-6 py-3 text-[0.85em] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--tienda-color-acento)' }}
          >
            Agregar a la bolsa
          </button>
        </div>
      </div>
      <ProductosRelacionados productos={producto.relacionados} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} estiloInsigniaSinStock={tema.estiloInsigniaSinStock} />
      <Footer nombre={nombre} />
    </div>
  );
}

function BrumaCarrito({ config, subdominio, carrito }: PropsCarrito) {
  const { tema, nombre, logo } = config;
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  return (
    <div
      className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]"
      style={{ ...variablesCssTema(tema, DEFAULTS), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}
    >
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <h1 className="mb-6 text-[1.4em] font-semibold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          Tu bolsa
        </h1>
        {carrito.items.length === 0 && <p className="text-[0.85em] opacity-60">Tu bolsa está vacía.</p>}
        <div className="flex flex-col gap-4">
          {carrito.items.map((item) => (
            <div key={item.varianteId} className="flex items-center gap-4 rounded-[var(--tienda-radio-tarjeta)] bg-[var(--tienda-color-superficie)] p-3 shadow-[var(--tienda-sombra-tarjeta)]">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--tienda-color-acento) 30%, var(--tienda-color-superficie))' }}>
                {item.imagen && <img src={item.imagen} alt={item.nombre} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-[0.85em] font-semibold">{item.nombre}</p>
                {item.varianteEtiqueta && <p className="text-[0.75em] opacity-60">{item.varianteEtiqueta}</p>}
                <p className="text-[0.75em] opacity-60">{formatearPrecio(item.precio)} c/u</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad - 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--tienda-color-texto)]/15">
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center text-[0.85em]">{item.cantidad}</span>
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad + 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--tienda-color-texto)]/15">
                  <Plus size={13} />
                </button>
              </div>
              <span className="w-20 text-right text-[0.85em] font-bold">{formatearPrecio(item.precio * item.cantidad)}</span>
              <button type="button" onClick={() => carrito.quitar(item.varianteId)} className="opacity-60 hover:opacity-100 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        {carrito.items.length > 0 && (
          <div className="mt-8 flex flex-col items-end gap-3 border-t border-[color:var(--tienda-color-texto)]/10 pt-6">
            <p className="text-[1.1em] font-bold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
              Total: {formatearPrecio(carrito.total)}
            </p>
            <Link to={`/tienda/${subdominio}/checkout`} className="rounded-full px-6 py-3 text-[0.85em] font-bold text-white" style={{ background: 'var(--tienda-color-acento)' }}>
              Finalizar compra
            </Link>
          </div>
        )}
      </div>
      <Footer nombre={nombre} />
    </div>
  );
}

export const bruma: Plantilla = { Home: BrumaHome, Producto: BrumaProducto, Carrito: BrumaCarrito };
