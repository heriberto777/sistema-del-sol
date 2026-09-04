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
import { ClaveMenuTienda, DefaultsTemaPlantilla, menuVisibleOrdenado, useCargarFuentesTienda, variablesCssTema } from '../tema';
import type { Plantilla, PropsCarrito, PropsHome, PropsProducto } from './tipos';

// Fase 12 — "marketplace" denso estilo amazon.com: header oscuro fijo,
// chips de categoría, estantes de ofertas/destacados y grilla de catálogo
// más apretada que el resto de las plantillas (más columnas, menos aire).
const DEFAULTS: DefaultsTemaPlantilla = {
  colorAcento: '#e8a33d',
  colorFondo: '#eaeded',
  colorSuperficie: '#ffffff',
  colorTexto: '#0f1111',
  fuenteDisplay: 'Schibsted Grotesk',
  fuenteBody: 'DM Sans',
};

const HEADER_BG = '#131a22';
const HEADER_BG_2 = '#232f3e';

const ENLACES_MENU: Record<ClaveMenuTienda, { label: string; href: (subdominio: string) => string }> = {
  inicio: { label: 'Inicio', href: (s) => `/tienda/${s}` },
  categorias: { label: 'Productos', href: (s) => `/tienda/${s}#catalogo` },
  carrito: { label: 'Carrito', href: (s) => `/tienda/${s}/carrito` },
  cuenta: { label: 'Mi cuenta', href: (s) => `/tienda/${s}/mis-pedidos` },
};

function Nav({ nombre, logo, subdominio, cantidadCarrito, menu }: { nombre: string; logo: string | null; subdominio: string; cantidadCarrito: number; menu: ClaveMenuTienda[] }) {
  const { autenticado } = useClienteTienda(subdominio);
  const { abrir } = useCarritoDrawer();
  return (
    <div className="flex items-center gap-6 px-6 py-3 sm:px-10" style={{ background: HEADER_BG }}>
      <Link to={`/tienda/${subdominio}`} className="flex items-center gap-2 text-white" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
        {logo && <img src={logo} alt={nombre} className="h-8 w-8 rounded object-cover" />}
        <span className="text-[1.15em] font-extrabold">{nombre}</span>
      </Link>
      <div className="ml-auto flex items-center gap-5">
        {menu.map((clave) => {
          if (clave === 'cuenta') {
            return (
              <Link key={clave} to={autenticado ? ENLACES_MENU.cuenta.href(subdominio) : `/tienda/${subdominio}/login`} className="flex items-center gap-1.5 text-[0.78em] font-semibold text-white/85">
                <User size={15} />
                {autenticado ? 'Mi cuenta' : 'Ingresar'}
              </Link>
            );
          }
          if (clave === 'carrito') {
            return (
              <button key={clave} type="button" onClick={abrir} className="flex items-center gap-2 rounded px-3 py-1.5 text-[0.8em] font-bold" style={{ background: 'var(--tienda-color-acento)', color: '#111' }}>
                <ShoppingCart size={14} />
                {cantidadCarrito}
              </button>
            );
          }
          return (
            <Link key={clave} to={ENLACES_MENU[clave].href(subdominio)} className="text-[0.78em] font-semibold text-white/85">
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
    <div className="flex flex-col items-center gap-1 px-6 py-8 text-[0.72em] text-white/60 sm:px-10" style={{ background: HEADER_BG }}>
      <span>© {nombre}</span>
      <span>Powered by Sistema del Sol</span>
    </div>
  );
}

function ThumbBazar({ imagen, nombre }: { imagen: string | null; nombre: string }) {
  return (
    <div className="w-full overflow-hidden" style={{ aspectRatio: 'var(--tienda-ratio-imagen)', borderRadius: 'var(--tienda-radio-tarjeta)', background: 'linear-gradient(140deg, color-mix(in srgb, var(--tienda-color-acento) 16%, var(--tienda-color-superficie)), var(--tienda-color-superficie))' }}>
      {imagen && <img src={imagen} alt={nombre} className="h-full w-full object-cover" />}
    </div>
  );
}

function BazarHome({ config, subdominio, carrito, productos, cargando, busqueda, onBuscar, categorias, categoriaId, onCategoriaSeleccionar }: PropsHome) {
  const { tema, nombre, logo } = config;
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  const { data: destacados = [] } = useProductosDestacados(subdominio);
  const { data: ofertas = [] } = useOfertasTienda(subdominio);
  const { data: secciones = [] } = useSeccionesTienda(subdominio);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <BannerAnuncio mensajes={config.bannerAnuncio.mensajes} intervaloSegundos={config.bannerAnuncio.intervaloSegundos} colorAcento={DEFAULTS.colorAcento} />
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />

      <div className="flex items-center gap-2 overflow-x-auto px-6 py-2.5 sm:px-10" style={{ background: HEADER_BG_2 }}>
        <button
          type="button"
          onClick={() => onCategoriaSeleccionar(undefined)}
          className="whitespace-nowrap rounded-full px-3 py-1 text-[0.75em] font-semibold"
          style={{ background: !categoriaId ? 'var(--tienda-color-acento)' : 'transparent', color: !categoriaId ? '#111' : '#fff', opacity: !categoriaId ? 1 : 0.8 }}
        >
          Todo
        </button>
        {categorias.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onCategoriaSeleccionar(c.id)}
            className="whitespace-nowrap rounded-full px-3 py-1 text-[0.75em] font-semibold"
            style={{ background: categoriaId === c.id ? 'var(--tienda-color-acento)' : 'transparent', color: categoriaId === c.id ? '#111' : '#fff', opacity: categoriaId === c.id ? 1 : 0.8 }}
          >
            {c.nombre}
          </button>
        ))}
        <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar en la tienda…"
            className="w-full rounded py-1.5 pl-8 pr-3 text-[0.8em] text-slate-900 outline-none"
          />
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="rounded-lg p-8 text-white sm:p-12" style={{ background: `linear-gradient(120deg, ${HEADER_BG}, ${HEADER_BG_2})`, borderRadius: 'var(--tienda-radio-tarjeta)' }}>
          <div className="mb-2 text-[0.7em] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--tienda-color-acento)' }}>
            Bienvenido a
          </div>
          <h1 className="mb-2 max-w-lg text-[1.9em] font-extrabold leading-tight" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
            {nombre}
          </h1>
          <p className="max-w-md text-[0.85em] text-white/70">Encontrá lo que buscás — catálogo completo, precio y disponibilidad reales.</p>
        </div>
      </div>

      <SeccionOfertas ofertas={ofertas} mostrar={tema.mostrarSeccionOfertas} />
      <SeccionDestacados productos={destacados} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} />
      <SeccionesDinamicas secciones={secciones} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} />

      <div className="mx-4 mb-6 overflow-hidden sm:mx-6" style={{ borderRadius: 'var(--tienda-radio-tarjeta)' }}>
        {config.banner ? (
          <img src={config.banner} alt="" className="aspect-[21/6] w-full object-cover" />
        ) : (
          <a
            href="#catalogo"
            className="flex aspect-[21/6] w-full items-center justify-center text-center text-[1.1em] font-extrabold text-white sm:text-[1.3em]"
            style={{ background: `linear-gradient(120deg, color-mix(in srgb, var(--tienda-color-acento) 70%, ${HEADER_BG}), ${HEADER_BG})`, fontFamily: 'var(--tienda-fuente-display)' }}
          >
            Descubrí todo el catálogo →
          </a>
        )}
      </div>

      <div id="catalogo" className="px-4 pb-4 sm:px-6">
        <h2 className="mb-3 text-[1.05em] font-bold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          Productos{categoriaId ? ` · ${categorias.find((c) => c.id === categoriaId)?.nombre ?? ''}` : ''}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 pb-16 sm:grid-cols-3 sm:px-6 lg:grid-cols-5">
        {cargando && <p className="col-span-full text-[0.85em] opacity-60">Cargando…</p>}
        {!cargando && productos.length === 0 && <p className="col-span-full text-[0.85em] opacity-60">No hay productos.</p>}
        {productos.map((p) => (
          <Link key={p.id} to={`/tienda/${subdominio}/producto/${p.id}`} className="overflow-hidden bg-[var(--tienda-color-superficie)] p-2" style={{ borderRadius: 'var(--tienda-radio-tarjeta)', boxShadow: 'var(--tienda-sombra-tarjeta)' }}>
            <div className="relative">
              <ThumbBazar imagen={p.imagen} nombre={p.nombre} />
              <InsigniaOferta oferta={p.oferta} estilo={tema.estiloInsigniaOferta} />
            </div>
            <div className="pt-2">
              <h3 className="mb-1 text-[0.78em] font-semibold leading-tight">{p.nombre}</h3>
              <div className="flex items-center justify-between gap-1.5">
                <FilaPrecioOferta precio={p.precio} oferta={p.oferta} estilo={tema.estiloInsigniaOferta} tamano="0.82em" />
                {!p.tieneVariantes && p.varianteId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      carrito.agregar({ productoId: p.id, varianteId: p.varianteId!, varianteEtiqueta: '', nombre: p.nombre, precio: precioParaCarrito(p.precio, p.oferta), precioOriginal: precioOriginalParaCarrito(p.precio, p.oferta), imagen: p.imagen });
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#111]"
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

function BazarProducto({ config, subdominio, carrito, producto, varianteSeleccionada, onSeleccionarVariante, cantidad, onCantidadChange, onAgregar }: PropsProducto) {
  const { tema, nombre, logo } = config;
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  const debeElegirVariante = producto.variantes.length > 1;
  const galeria = [producto.imagen, ...producto.imagenesAdicionales].filter((img): img is string => !!img);
  const [imagenActiva, setImagenActiva] = useState(galeria[0] ?? null);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="mx-auto grid max-w-4xl gap-10 px-6 py-10 sm:grid-cols-2 sm:px-10">
        <div>
          <div className="overflow-hidden bg-[var(--tienda-color-superficie)] p-3" style={{ aspectRatio: 'var(--tienda-ratio-imagen)', borderRadius: 'var(--tienda-radio-tarjeta)' }}>
            <ThumbBazar imagen={imagenActiva} nombre={producto.nombre} />
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
          <h1 className="mb-2 text-[1.4em] font-bold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
            {producto.nombre}
          </h1>
          <div className="mb-3 text-[0.75em] opacity-50">SKU {producto.codigo}</div>
          <div className="mb-4">
            {varianteSeleccionada ? (
              <FilaPrecioOferta precio={varianteSeleccionada.precio} oferta={varianteSeleccionada.oferta} estilo={tema.estiloInsigniaOferta} tamano="1.3em" />
            ) : (
              <p className="text-[1.3em] font-extrabold" style={{ color: 'var(--tienda-color-acento)' }}>Elegí una opción</p>
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
                  className="flex items-center justify-between rounded border px-3 py-2 text-left text-[0.85em] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: varianteSeleccionada?.id === v.id ? 'var(--tienda-color-acento)' : 'color-mix(in srgb, var(--tienda-color-texto) 15%, transparent)' }}
                >
                  <span className="flex flex-col">
                    <span>{v.etiqueta || '(sin atributos)'}</span>
                    {v.stock !== null && <span className="text-[0.75em] opacity-60">{v.stock > 0 ? `${v.stock} disponibles` : 'Sin existencia'}</span>}
                  </span>
                  <span className="font-bold" style={{ color: 'var(--tienda-color-acento)' }}>
                    {formatearPrecio(v.precio)}
                  </span>
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
          <button
            type="button"
            onClick={onAgregar}
            disabled={!varianteSeleccionada}
            className="rounded px-6 py-3 text-[0.85em] font-bold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--tienda-color-acento)', color: '#111' }}
          >
            Agregar al carrito
          </button>
        </div>
      </div>
      <ProductosRelacionados productos={producto.relacionados} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} />
      <Footer nombre={nombre} />
    </div>
  );
}

function BazarCarrito({ config, subdominio, carrito }: PropsCarrito) {
  const { tema, nombre, logo } = config;
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <h1 className="mb-6 text-[1.4em] font-bold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          Tu carrito
        </h1>
        {carrito.items.length === 0 && <p className="text-[0.85em] opacity-60">Tu carrito está vacío.</p>}
        <div className="flex flex-col gap-4">
          {carrito.items.map((item) => (
            <div key={item.varianteId} className="flex items-center gap-4 bg-[var(--tienda-color-superficie)] p-3" style={{ borderRadius: 'var(--tienda-radio-tarjeta)', boxShadow: 'var(--tienda-sombra-tarjeta)' }}>
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded" style={{ background: 'color-mix(in srgb, var(--tienda-color-acento) 15%, var(--tienda-color-superficie))' }}>
                {item.imagen && <img src={item.imagen} alt={item.nombre} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-[0.85em] font-semibold">{item.nombre}</p>
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
            <Link to={`/tienda/${subdominio}/checkout`} className="rounded px-6 py-3 text-[0.85em] font-bold" style={{ background: 'var(--tienda-color-acento)', color: '#111' }}>
              Finalizar compra
            </Link>
          </div>
        )}
      </div>
      <Footer nombre={nombre} />
    </div>
  );
}

export const bazar: Plantilla = { Home: BazarHome, Producto: BazarProducto, Carrito: BazarCarrito };
