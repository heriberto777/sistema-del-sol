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

// Fase 8 — ropa "fast fashion", insp. Zara: casi monocromo, fotografía en
// blanco y negro como acento, sin grilla rígida, badges discretos.
const DEFAULTS: DefaultsTemaPlantilla = {
  colorAcento: '#c0392b',
  colorFondo: '#ffffff',
  colorSuperficie: '#ffffff',
  colorTexto: '#131313',
  fuenteDisplay: 'Fraunces',
  fuenteBody: 'Work Sans',
};

const ENLACES_MENU: Record<ClaveMenuTienda, { label: string; href: (subdominio: string) => string }> = {
  inicio: { label: 'Nuevo', href: (s) => `/tienda/${s}` },
  categorias: { label: 'Colección', href: (s) => `/tienda/${s}#catalogo` },
  carrito: { label: 'Bolsa', href: (s) => `/tienda/${s}/carrito` },
  cuenta: { label: 'Cuenta', href: (s) => `/tienda/${s}/mis-pedidos` },
};

function Nav({ nombre, logo, subdominio, cantidadCarrito, menu }: { nombre: string; logo: string | null; subdominio: string; cantidadCarrito: number; menu: ClaveMenuTienda[] }) {
  const { autenticado } = useClienteTienda(subdominio);
  const { abrir } = useCarritoDrawer();
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--tienda-color-texto)]/10 px-6 py-5 sm:px-10">
      <Link to={`/tienda/${subdominio}`} className="flex items-center gap-2 uppercase" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
        {logo && <img src={logo} alt={nombre} className="h-8 w-8 object-cover" />}
        <span className="text-[1.15em] font-bold text-[var(--tienda-color-texto)]">{nombre}</span>
      </Link>
      <div className="flex items-center gap-6">
        {menu.map((clave) => {
          if (clave === 'cuenta') {
            return (
              <Link key={clave} to={autenticado ? ENLACES_MENU.cuenta.href(subdominio) : `/tienda/${subdominio}/login`} className="flex items-center gap-1.5 text-[0.72em] font-semibold uppercase tracking-[0.06em] text-[var(--tienda-color-texto)] opacity-70">
                <User size={14} />
                {autenticado ? 'Cuenta' : 'Acceder'}
              </Link>
            );
          }
          if (clave === 'carrito') {
            return (
              <button key={clave} type="button" onClick={abrir} className="flex items-center gap-1.5 text-[0.72em] font-semibold uppercase tracking-[0.06em] text-[var(--tienda-color-texto)]">
                <ShoppingCart size={14} />({cantidadCarrito})
              </button>
            );
          }
          return (
            <Link key={clave} to={ENLACES_MENU[clave].href(subdominio)} className="text-[0.72em] font-semibold uppercase tracking-[0.06em] text-[var(--tienda-color-texto)] opacity-70">
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
    <div className="flex justify-between border-t border-[color:var(--tienda-color-texto)]/10 px-6 py-6 text-[0.72em] uppercase tracking-[0.03em] opacity-50 sm:px-10">
      <span>© {nombre}</span>
      <span>Powered by Sistema del Sol</span>
    </div>
  );
}

function ThumbEditorial({ imagen, nombre }: { imagen: string | null; nombre: string }) {
  return (
    <div
      className="w-full overflow-hidden rounded-[var(--tienda-radio-tarjeta)] grayscale"
      style={{ aspectRatio: 'var(--tienda-ratio-imagen)', background: 'linear-gradient(120deg, #e2e2e2, #f4f4f4)' }}
    >
      {imagen && <img src={imagen} alt={nombre} className="h-full w-full object-cover" />}
    </div>
  );
}

function EditorialHome({ config, subdominio, carrito, productos, cargando, busqueda, onBuscar }: PropsHome) {
  const { tema, nombre, logo } = config;
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  const { data: destacados = [] } = useProductosDestacados(subdominio);
  const { data: ofertas = [] } = useOfertasTienda(subdominio);
  const { data: secciones = [] } = useSeccionesTienda(subdominio);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <BannerAnuncio mensajes={config.bannerAnuncio.mensajes} intervaloSegundos={config.bannerAnuncio.intervaloSegundos} />
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="relative">
        <div className="aspect-[16/7] grayscale" style={{ background: 'linear-gradient(100deg,#e6e6e6,#c9c9c9,#efefef)' }} />
        <div className="absolute bottom-5 left-6 bg-[var(--tienda-color-fondo)] px-4 py-2.5 sm:left-10">
          <h1 className="text-[1.3em] font-bold uppercase" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
            {nombre}
          </h1>
        </div>
      </div>

      <SeccionDestacados productos={destacados} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} estiloInsigniaSinStock={tema.estiloInsigniaSinStock} />
      <SeccionOfertas ofertas={ofertas} mostrar={tema.mostrarSeccionOfertas} />
      <SeccionesDinamicas secciones={secciones} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} estiloInsigniaSinStock={tema.estiloInsigniaSinStock} />

      <div id="catalogo" className="flex items-baseline justify-between px-6 pb-4 pt-6 sm:px-10">
        <h2 className="text-[1em] font-bold uppercase tracking-[0.03em]">Productos</h2>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar…"
            className="border border-[color:var(--tienda-color-texto)]/15 bg-[var(--tienda-color-fondo)] py-2 pl-8 pr-3 text-[0.8em] outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {cargando && <p className="col-span-full px-6 py-6 text-[0.85em] opacity-60 sm:px-10">Cargando…</p>}
        {!cargando && productos.length === 0 && <p className="col-span-full px-6 py-6 text-[0.85em] opacity-60 sm:px-10">No hay productos.</p>}
        {productos.map((p) => (
          <Link key={p.id} to={`/tienda/${subdominio}/producto/${p.id}`} className="relative border-b border-r border-[color:var(--tienda-color-texto)]/10 pb-3">
            {p.sinStock ? (
              <InsigniaSinStock sinStock estilo={tema.estiloInsigniaSinStock} />
            ) : p.oferta ? (
              <InsigniaOferta oferta={p.oferta} estilo={tema.estiloInsigniaOferta} />
            ) : (
              <span className="absolute left-2.5 top-2.5 text-[0.65em] font-semibold uppercase tracking-[0.04em]" style={{ color: 'var(--tienda-color-acento)' }}>
                Nuevo
              </span>
            )}
            <div className={claseImagenSinStock(p.sinStock, tema.estiloInsigniaSinStock)}>
              <ThumbEditorial imagen={p.imagen} nombre={p.nombre} />
            </div>
            <div className="px-2.5 pt-2.5">
              <h3 className="mb-1 text-[0.78em] font-medium">{p.nombre}</h3>
              <div className="flex items-center justify-between gap-1.5">
                {!p.sinStock && p.oferta ? (
                  <FilaPrecioOferta precio={p.precio} oferta={p.oferta} estilo={tema.estiloInsigniaOferta} tamano="0.78em" />
                ) : (
                  <span className="text-[0.78em] font-semibold">{formatearPrecio(p.precio)}</span>
                )}
                <TextoSinStock sinStock={p.sinStock} estilo={tema.estiloInsigniaSinStock} />
                {!p.tieneVariantes && p.varianteId && !p.sinStock && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      carrito.agregar({ productoId: p.id, varianteId: p.varianteId!, varianteEtiqueta: '', nombre: p.nombre, precio: precioParaCarrito(p.precio, p.oferta), precioOriginal: precioOriginalParaCarrito(p.precio, p.oferta), imagen: p.imagen });
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center border border-[color:var(--tienda-color-texto)]/20"
                  >
                    <Plus size={12} />
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

function EditorialProducto({ config, subdominio, carrito, producto, varianteSeleccionada, onSeleccionarVariante, cantidad, onCantidadChange, onAgregar }: PropsProducto) {
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
          <div className="overflow-hidden rounded-[var(--tienda-radio-tarjeta)]" style={{ aspectRatio: 'var(--tienda-ratio-imagen)' }}>
            <ThumbEditorial imagen={imagenActiva} nombre={producto.nombre} />
          </div>
          {galeria.length > 1 && (
            <div className="mt-3 flex gap-2">
              {galeria.map((img, i) => (
                <button key={i} type="button" onClick={() => setImagenActiva(img)} className="h-14 w-14 overflow-hidden border-2 grayscale" style={{ borderColor: imagenActiva === img ? 'var(--tienda-color-acento)' : 'transparent' }}>
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
          <div className="mb-4">
            {varianteSeleccionada ? (
              <FilaPrecioOferta precio={varianteSeleccionada.precio} oferta={varianteSeleccionada.oferta} estilo={tema.estiloInsigniaOferta} tamano="1.2em" />
            ) : (
              <p className="text-[1.2em] font-semibold">Elegí una opción</p>
            )}
          </div>
          {producto.descripcionTienda && <p className="mb-5 text-[0.85em] leading-relaxed opacity-60">{producto.descripcionTienda}</p>}

          {debeElegirVariante && (
            <div className="mb-5 flex flex-col gap-2">
              {producto.variantes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSeleccionarVariante(v.id)}
                  disabled={v.stock !== null && v.stock <= 0}
                  className="flex items-center justify-between border px-3 py-2 text-left text-[0.85em] disabled:cursor-not-allowed disabled:opacity-40"
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
                  <span className="font-semibold">{formatearPrecio(v.precio)}</span>
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
            <button type="button" onClick={() => onCantidadChange(Math.max(1, cantidad - 1))} className="flex h-9 w-9 items-center justify-center border border-[color:var(--tienda-color-texto)]/15">
              <Minus size={14} />
            </button>
            <span className="w-6 text-center font-semibold">{cantidad}</span>
            <button type="button" onClick={() => onCantidadChange(cantidad + 1)} className="flex h-9 w-9 items-center justify-center border border-[color:var(--tienda-color-texto)]/15">
              <Plus size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={onAgregar}
            disabled={!varianteSeleccionada}
            className="px-6 py-3 text-[0.8em] font-semibold uppercase tracking-[0.04em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--tienda-color-texto)' }}
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

function EditorialCarrito({ config, subdominio, carrito }: PropsCarrito) {
  const { tema, nombre, logo } = config;
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <h1 className="mb-6 text-[1.3em] font-semibold uppercase" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          Tu bolsa
        </h1>
        {carrito.items.length === 0 && <p className="text-[0.85em] opacity-60">Tu bolsa está vacía.</p>}
        <div className="flex flex-col gap-4">
          {carrito.items.map((item) => (
            <div key={item.varianteId} className="flex items-center gap-4 border border-[color:var(--tienda-color-texto)]/10 p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden grayscale" style={{ background: '#eee' }}>
                {item.imagen && <img src={item.imagen} alt={item.nombre} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-[0.85em] font-medium">{item.nombre}</p>
                {item.varianteEtiqueta && <p className="text-[0.75em] opacity-60">{item.varianteEtiqueta}</p>}
                <p className="text-[0.75em] opacity-60">{formatearPrecio(item.precio)} c/u</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad - 1)} className="flex h-7 w-7 items-center justify-center border border-[color:var(--tienda-color-texto)]/15">
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center text-[0.85em]">{item.cantidad}</span>
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad + 1)} className="flex h-7 w-7 items-center justify-center border border-[color:var(--tienda-color-texto)]/15">
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
            <p className="text-[1.05em] font-semibold">Total: {formatearPrecio(carrito.total)}</p>
            <Link to={`/tienda/${subdominio}/checkout`} className="px-6 py-3 text-[0.8em] font-semibold uppercase tracking-[0.04em] text-white" style={{ background: 'var(--tienda-color-texto)' }}>
              Finalizar compra
            </Link>
          </div>
        )}
      </div>
      <Footer nombre={nombre} />
    </div>
  );
}

export const editorial: Plantilla = { Home: EditorialHome, Producto: EditorialProducto, Carrito: EditorialCarrito };
