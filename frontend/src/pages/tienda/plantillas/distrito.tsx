import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Search, ShoppingCart, Trash2, User } from 'lucide-react';
import { formatearPrecio, useOfertasTienda, useProductosDestacados } from '../../../hooks/useTienda';
import { useClienteTienda } from '../../../hooks/useClienteTienda';
import { useCarritoDrawer } from '../CarritoDrawerContext';
import { BannerAnuncio } from '../BannerAnuncio';
import { SeccionDestacados } from '../SeccionDestacados';
import { SeccionOfertas } from '../SeccionOfertas';
import { ProductosRelacionados } from '../ProductosRelacionados';
import { ClaveMenuTienda, DefaultsTemaPlantilla, menuVisibleOrdenado, useCargarFuentesTienda, variablesCssTema } from '../tema';
import type { Plantilla, PropsCarrito, PropsHome, PropsProducto } from './tipos';

// Fase 8 — tienda de ropa departamental premium, insp. grandes almacenes:
// serif clásica, categorías organizadas, foto de estudio prolija.
const DEFAULTS: DefaultsTemaPlantilla = {
  colorAcento: '#6d2530',
  colorFondo: '#ffffff',
  colorSuperficie: '#f7f6f3',
  colorTexto: '#1c1c1c',
  fuenteDisplay: 'Playfair Display',
  fuenteBody: 'DM Sans',
};

const ENLACES_MENU: Record<ClaveMenuTienda, { label: string; href: (subdominio: string) => string }> = {
  inicio: { label: 'Inicio', href: (s) => `/tienda/${s}` },
  categorias: { label: 'Categorías', href: (s) => `/tienda/${s}#catalogo` },
  carrito: { label: 'Bolsa', href: (s) => `/tienda/${s}/carrito` },
  cuenta: { label: 'Mi cuenta', href: (s) => `/tienda/${s}/mis-pedidos` },
};

function Nav({ nombre, logo, subdominio, cantidadCarrito, menu }: { nombre: string; logo: string | null; subdominio: string; cantidadCarrito: number; menu: ClaveMenuTienda[] }) {
  const { autenticado } = useClienteTienda(subdominio);
  const { abrir } = useCarritoDrawer();
  return (
    <div>
      <div className="px-6 py-1.5 text-center text-[0.68em] font-semibold uppercase tracking-[0.04em] text-white sm:px-10" style={{ background: 'var(--tienda-color-acento)' }}>
        Envío gratis en compras desde RD$ 3,000
      </div>
      <div className="flex items-center justify-between border-b border-[color:var(--tienda-color-texto)]/10 px-6 py-4 sm:px-10">
        <Link to={`/tienda/${subdominio}`} className="flex items-center gap-2" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          {logo && <img src={logo} alt={nombre} className="h-8 w-8 object-cover" />}
          <span className="text-[1.25em] font-bold text-[var(--tienda-color-texto)]">{nombre}</span>
        </Link>
        <div className="flex items-center gap-6">
          {menu.map((clave) => {
            if (clave === 'cuenta') {
              return (
                <Link key={clave} to={autenticado ? ENLACES_MENU.cuenta.href(subdominio) : `/tienda/${subdominio}/login`} className="flex items-center gap-1.5 text-[0.72em] font-semibold uppercase tracking-[0.04em] text-[var(--tienda-color-texto)] opacity-70">
                  <User size={14} />
                  {autenticado ? 'Mi cuenta' : 'Ingresar'}
                </Link>
              );
            }
            if (clave === 'carrito') {
              return (
                <button key={clave} type="button" onClick={abrir} className="flex items-center gap-1.5 text-[0.72em] font-semibold uppercase tracking-[0.04em] text-[var(--tienda-color-texto)]">
                  <ShoppingCart size={14} />({cantidadCarrito})
                </button>
              );
            }
            return (
              <Link key={clave} to={ENLACES_MENU[clave].href(subdominio)} className="text-[0.72em] font-semibold uppercase tracking-[0.04em] text-[var(--tienda-color-texto)] opacity-70">
                {ENLACES_MENU[clave].label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Footer({ nombre }: { nombre: string }) {
  return (
    <div className="flex justify-between border-t border-[color:var(--tienda-color-texto)]/10 px-6 py-6 text-[0.72em] opacity-50 sm:px-10">
      <span>© {nombre}</span>
      <span>Powered by Sistema del Sol</span>
    </div>
  );
}

function ThumbDistrito({ imagen, nombre }: { imagen: string | null; nombre: string }) {
  return (
    <div className="w-full overflow-hidden rounded-[var(--tienda-radio-tarjeta)] bg-[var(--tienda-color-superficie)]" style={{ aspectRatio: 'var(--tienda-ratio-imagen)' }}>
      {imagen && <img src={imagen} alt={nombre} className="h-full w-full object-cover" />}
    </div>
  );
}

function DistritoHome({ config, subdominio, carrito, productos, cargando, busqueda, onBuscar }: PropsHome) {
  const { tema, nombre, logo } = config;
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  const { data: destacados = [] } = useProductosDestacados(subdominio);
  const { data: ofertas = [] } = useOfertasTienda(subdominio);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <BannerAnuncio texto={config.bannerTexto} />
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="px-6 pb-6 pt-10 text-center sm:px-10">
        <div className="mb-2 text-[0.7em] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--tienda-color-acento)' }}>
          Temporada
        </div>
        <h1 className="mb-3 text-[1.8em] font-bold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          {nombre}
        </h1>
        <p className="mx-auto max-w-md text-[0.85em] opacity-60">Curaduría de marcas seleccionadas, con la garantía y el servicio de siempre.</p>
      </div>

      <SeccionDestacados productos={destacados} subdominio={subdominio} />
      <SeccionOfertas ofertas={ofertas} />

      <div id="catalogo" className="flex items-baseline justify-between px-6 pb-4 pt-4 sm:px-10">
        <h2 className="text-[1.05em] font-bold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          Catálogo
        </h2>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar…"
            className="rounded border border-[color:var(--tienda-color-texto)]/15 bg-[var(--tienda-color-fondo)] py-2 pl-8 pr-3 text-[0.8em] outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 px-6 pb-16 sm:grid-cols-3 sm:px-10 lg:grid-cols-4">
        {cargando && <p className="col-span-full text-[0.85em] opacity-60">Cargando…</p>}
        {!cargando && productos.length === 0 && <p className="col-span-full text-[0.85em] opacity-60">No hay productos.</p>}
        {productos.map((p) => (
          <Link key={p.id} to={`/tienda/${subdominio}/producto/${p.id}`} className="text-center">
            <ThumbDistrito imagen={p.imagen} nombre={p.nombre} />
            <div className="pt-2.5">
              {p.categoria && <div className="text-[0.62em] uppercase tracking-[0.05em] opacity-40">{p.categoria.nombre}</div>}
              <h3 className="mb-1 mt-0.5 text-[0.85em] font-semibold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
                {p.nombre}
              </h3>
              <div className="flex items-center justify-center gap-2">
                <span className="text-[0.8em] font-semibold">{formatearPrecio(p.precio)}</span>
                {!p.tieneVariantes && p.varianteId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      carrito.agregar({ productoId: p.id, varianteId: p.varianteId!, varianteEtiqueta: '', nombre: p.nombre, precio: Number(p.precio ?? 0), imagen: p.imagen });
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded text-white"
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

function DistritoProducto({ config, subdominio, carrito, producto, varianteSeleccionada, onSeleccionarVariante, cantidad, onCantidadChange, onAgregar }: PropsProducto) {
  const { tema, nombre, logo } = config;
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  const debeElegirVariante = producto.variantes.length > 1;
  const galeria = [producto.imagen, ...producto.imagenesAdicionales].filter((img): img is string => !!img);
  const [imagenActiva, setImagenActiva] = useState(galeria[0] ?? null);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="mx-auto grid max-w-4xl gap-10 px-6 py-12 sm:grid-cols-2 sm:px-10">
        <div>
          <div className="overflow-hidden rounded-[var(--tienda-radio-tarjeta)] bg-[var(--tienda-color-superficie)]" style={{ aspectRatio: 'var(--tienda-ratio-imagen)' }}>
            {imagenActiva && <img src={imagenActiva} alt={producto.nombre} className="h-full w-full object-cover" />}
          </div>
          {galeria.length > 1 && (
            <div className="mt-3 flex gap-2">
              {galeria.map((img, i) => (
                <button key={i} type="button" onClick={() => setImagenActiva(img)} className="h-14 w-14 overflow-hidden rounded border-2" style={{ borderColor: imagenActiva === img ? 'var(--tienda-color-acento)' : 'transparent' }}>
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="mb-2 text-[1.5em] font-bold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
            {producto.nombre}
          </h1>
          <p className="mb-4 text-[1.2em] font-semibold">{varianteSeleccionada ? formatearPrecio(varianteSeleccionada.precio) : 'Elegí una opción'}</p>
          {producto.descripcionTienda && <p className="mb-5 text-[0.85em] leading-relaxed opacity-60">{producto.descripcionTienda}</p>}

          {debeElegirVariante && (
            <div className="mb-5 flex flex-col gap-2">
              {producto.variantes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSeleccionarVariante(v.id)}
                  disabled={v.stock !== null && v.stock <= 0}
                  className="flex items-center justify-between rounded border px-3 py-2 text-left text-[0.85em] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: varianteSeleccionada?.id === v.id ? 'var(--tienda-color-acento)' : 'color-mix(in srgb, var(--tienda-color-texto) 15%, transparent)' }}
                >
                  <span className="flex flex-col">
                    <span>{v.etiqueta || '(sin atributos)'}</span>
                    {v.stock !== null && <span className="text-[0.75em] opacity-60">{v.stock > 0 ? `${v.stock} disponibles` : 'Sin existencia'}</span>}
                  </span>
                  <span className="font-semibold">{formatearPrecio(v.precio)}</span>
                </button>
              ))}
            </div>
          )}

          {varianteSeleccionada && varianteSeleccionada.stock !== null && (
            <p className="mb-6 text-[0.85em] opacity-60">{varianteSeleccionada.stock > 0 ? `${varianteSeleccionada.stock} disponibles` : 'Sin stock'}</p>
          )}
          <div className="mb-5 flex items-center gap-3">
            <button type="button" onClick={() => onCantidadChange(Math.max(1, cantidad - 1))} className="flex h-9 w-9 items-center justify-center rounded border border-[color:var(--tienda-color-texto)]/15">
              <Minus size={14} />
            </button>
            <span className="w-6 text-center font-semibold">{cantidad}</span>
            <button type="button" onClick={() => onCantidadChange(cantidad + 1)} className="flex h-9 w-9 items-center justify-center rounded border border-[color:var(--tienda-color-texto)]/15">
              <Plus size={14} />
            </button>
          </div>
          <button type="button" onClick={onAgregar} disabled={!varianteSeleccionada} className="rounded px-6 py-3 text-[0.85em] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ background: 'var(--tienda-color-acento)' }}>
            Agregar a la bolsa
          </button>
        </div>
      </div>
      <ProductosRelacionados productos={producto.relacionados} subdominio={subdominio} />
      <Footer nombre={nombre} />
    </div>
  );
}

function DistritoCarrito({ config, subdominio, carrito }: PropsCarrito) {
  const { tema, nombre, logo } = config;
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <h1 className="mb-6 text-[1.4em] font-bold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          Tu bolsa
        </h1>
        {carrito.items.length === 0 && <p className="text-[0.85em] opacity-60">Tu bolsa está vacía.</p>}
        <div className="flex flex-col gap-4">
          {carrito.items.map((item) => (
            <div key={item.varianteId} className="flex items-center gap-4 rounded-[var(--tienda-radio-tarjeta)] bg-[var(--tienda-color-superficie)] p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-[var(--tienda-color-fondo)]">
                {item.imagen && <img src={item.imagen} alt={item.nombre} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-[0.85em] font-medium">{item.nombre}</p>
                {item.varianteEtiqueta && <p className="text-[0.75em] opacity-60">{item.varianteEtiqueta}</p>}
                <p className="text-[0.75em] opacity-60">{formatearPrecio(item.precio)} c/u</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad - 1)} className="flex h-7 w-7 items-center justify-center rounded border border-[color:var(--tienda-color-texto)]/15">
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center text-[0.85em]">{item.cantidad}</span>
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad + 1)} className="flex h-7 w-7 items-center justify-center rounded border border-[color:var(--tienda-color-texto)]/15">
                  <Plus size={13} />
                </button>
              </div>
              <span className="w-20 text-right text-[0.85em] font-semibold">{formatearPrecio(item.precio * item.cantidad)}</span>
              <button type="button" onClick={() => carrito.quitar(item.varianteId)} className="opacity-60 hover:opacity-100 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        {carrito.items.length > 0 && (
          <div className="mt-8 flex flex-col items-end gap-3 border-t border-[color:var(--tienda-color-texto)]/10 pt-6">
            <p className="text-[1.05em] font-bold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
              Total: {formatearPrecio(carrito.total)}
            </p>
            <Link to={`/tienda/${subdominio}/checkout`} className="rounded px-6 py-3 text-[0.85em] font-semibold text-white" style={{ background: 'var(--tienda-color-acento)' }}>
              Finalizar compra
            </Link>
          </div>
        )}
      </div>
      <Footer nombre={nombre} />
    </div>
  );
}

export const distrito: Plantilla = { Home: DistritoHome, Producto: DistritoProducto, Carrito: DistritoCarrito };
