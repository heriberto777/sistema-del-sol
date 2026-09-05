import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Search, ShieldCheck, ShoppingCart, Trash2, Truck, User } from 'lucide-react';
import { formatearPrecio, useOfertasTienda, useProductosDestacados, useSeccionesTienda } from '../../../hooks/useTienda';
import { useClienteTienda } from '../../../hooks/useClienteTienda';
import { useCarritoDrawer } from '../CarritoDrawerContext';
import { BannerAnuncio } from '../BannerAnuncio';
import { SeccionDestacados } from '../SeccionDestacados';
import { SeccionOfertas } from '../SeccionOfertas';
import { SeccionesDinamicas } from '../SeccionesDinamicas';
import { ProductosRelacionados } from '../ProductosRelacionados';
import { FilaPrecioOferta } from '../OfertaEnTarjeta';
import { EtiquetaSinExistenciaVariante } from '../InsigniaSinStock';
import { ClaveMenuTienda, DefaultsTemaPlantilla, menuVisibleOrdenado, useCargarFuentesTienda, variablesCssTema } from '../tema';
import { useTiendaTema } from '../TiendaTemaContext';
import { ToggleTemaTienda } from '../ToggleTemaTienda';
import type { Plantilla, PropsCarrito, PropsHome, PropsProducto } from './tipos';

// Fase 12 — "marketplace" denso estilo ebay.com: header claro, acento
// azul, chips de categoría, franja de confianza (envío/pago/devolución)
// y tarjetas más redondeadas que Bazar.
const DEFAULTS: DefaultsTemaPlantilla = {
  colorAcento: '#3665f3',
  colorFondo: '#f5f6fb',
  colorSuperficie: '#ffffff',
  colorTexto: '#171a2b',
  fuenteDisplay: 'Outfit',
  fuenteBody: 'Nunito Sans',
};

const ENLACES_MENU: Record<ClaveMenuTienda, { label: string; href: (subdominio: string) => string }> = {
  inicio: { label: 'Inicio', href: (s) => `/tienda/${s}` },
  categorias: { label: 'Productos', href: (s) => `/tienda/${s}/productos` },
  carrito: { label: 'Carrito', href: (s) => `/tienda/${s}/carrito` },
  cuenta: { label: 'Mi cuenta', href: (s) => `/tienda/${s}/mis-pedidos` },
};

function Nav({ nombre, logo, subdominio, cantidadCarrito, menu }: { nombre: string; logo: string | null; subdominio: string; cantidadCarrito: number; menu: ClaveMenuTienda[] }) {
  const { autenticado } = useClienteTienda(subdominio);
  const { abrir } = useCarritoDrawer();
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-[var(--tienda-color-superficie)] px-6 py-3.5 shadow-sm sm:px-10">
      <Link to={`/tienda/${subdominio}`} className="flex items-center gap-2" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
        {logo && <img src={logo} alt={nombre} className="h-8 w-auto max-w-[7rem] rounded-full object-contain" />}
        <span className="text-[1.15em] font-extrabold text-[var(--tienda-color-texto)]">{nombre}</span>
      </Link>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3 gap-y-2 sm:gap-5">
        {menu.map((clave) => {
          if (clave === 'cuenta') {
            return (
              <Link key={clave} to={autenticado ? ENLACES_MENU.cuenta.href(subdominio) : `/tienda/${subdominio}/login`} className="flex items-center gap-1.5 text-[0.78em] font-semibold text-[var(--tienda-color-texto)] opacity-70">
                <User size={15} />
                {autenticado ? 'Mi cuenta' : 'Ingresar'}
              </Link>
            );
          }
          if (clave === 'carrito') {
            return (
              <button key={clave} type="button" onClick={abrir} className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[0.8em] font-bold text-white" style={{ background: 'var(--tienda-color-acento)' }}>
                <ShoppingCart size={14} />
                {cantidadCarrito}
              </button>
            );
          }
          return (
            <Link key={clave} to={ENLACES_MENU[clave].href(subdominio)} className="text-[0.78em] font-semibold text-[var(--tienda-color-texto)] opacity-70">
              {ENLACES_MENU[clave].label}
            </Link>
          );
        })}
        <ToggleTemaTienda className="text-[var(--tienda-color-texto)] opacity-70" />
      </div>
    </div>
  );
}

function Footer({ nombre }: { nombre: string }) {
  return (
    <div className="flex justify-between bg-[var(--tienda-color-superficie)] px-6 py-6 text-[0.72em] opacity-50 sm:px-10">
      <span>© {nombre}</span>
      <span>Powered by Sistema del Sol</span>
    </div>
  );
}

function ThumbVitrina({ imagen, nombre }: { imagen: string | null; nombre: string }) {
  return (
    <div className="w-full overflow-hidden" style={{ aspectRatio: 'var(--tienda-ratio-imagen)', borderRadius: 'var(--tienda-radio-tarjeta)', background: 'color-mix(in srgb, var(--tienda-color-acento) 12%, var(--tienda-color-superficie))' }}>
      {imagen && <img src={imagen} alt={nombre} className="h-full w-full object-cover" />}
    </div>
  );
}

function VitrinaHome({ config, subdominio, carrito }: PropsHome) {
  const { tema, nombre, logo } = config;
  const { modo } = useTiendaTema();
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const { data: destacados = [] } = useProductosDestacados(subdominio);
  const { data: ofertas = [] } = useOfertasTienda(subdominio);
  const { data: secciones = [] } = useSeccionesTienda(subdominio);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS, modo), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <BannerAnuncio mensajes={config.bannerAnuncio.mensajes} intervaloSegundos={config.bannerAnuncio.intervaloSegundos} colorAcento={DEFAULTS.colorAcento} />
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />

      <div className="p-4 sm:p-6">
        <div className="flex flex-col items-center gap-4 p-8 text-center text-white sm:p-12" style={{ background: 'linear-gradient(120deg, var(--tienda-color-acento), color-mix(in srgb, var(--tienda-color-acento) 60%, #7a4ad1))', borderRadius: 'var(--tienda-radio-tarjeta)' }}>
          <h1 className="max-w-lg text-[1.7em] font-extrabold leading-tight" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
            {nombre}
          </h1>
          <form
            className="relative w-full max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/tienda/${subdominio}/productos${busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : ''}`);
            }}
          >
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar productos…"
              className="w-full rounded-full bg-[var(--tienda-color-superficie)] py-3 pl-11 pr-4 text-[0.85em] text-[var(--tienda-color-texto)] outline-none"
            />
          </form>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 pb-6 text-center sm:px-6">
        {[
          { icon: Truck, label: 'Envío a todo el país' },
          { icon: ShieldCheck, label: 'Pago seguro' },
          { icon: ShoppingCart, label: 'Compra fácil' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 bg-[var(--tienda-color-superficie)] p-3" style={{ borderRadius: 'var(--tienda-radio-tarjeta)', boxShadow: 'var(--tienda-sombra-tarjeta)' }}>
            <Icon size={18} style={{ color: 'var(--tienda-color-acento)' }} />
            <span className="text-[0.68em] font-semibold opacity-70">{label}</span>
          </div>
        ))}
      </div>

      <SeccionOfertas ofertas={ofertas} mostrar={tema.mostrarSeccionOfertas} />
      <SeccionDestacados productos={destacados} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} estiloInsigniaSinStock={tema.estiloInsigniaSinStock} />
      <SeccionesDinamicas secciones={secciones} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} estiloInsigniaSinStock={tema.estiloInsigniaSinStock} />

      <Link
        to={`/tienda/${subdominio}/productos`}
        className="mx-4 mb-6 flex overflow-hidden sm:mx-6"
        style={{ borderRadius: 'var(--tienda-radio-tarjeta)' }}
      >
        {config.banner ? (
          <img src={config.banner} alt="" className="aspect-[21/6] w-full object-cover" />
        ) : (
          <span
            className="flex aspect-[21/6] w-full items-center justify-center text-center text-[1.1em] font-extrabold text-white sm:text-[1.3em]"
            style={{ background: 'linear-gradient(120deg, var(--tienda-color-acento), color-mix(in srgb, var(--tienda-color-acento) 55%, #7a4ad1))', fontFamily: 'var(--tienda-fuente-display)' }}
          >
            Explorá todo el catálogo →
          </span>
        )}
      </Link>
      <Footer nombre={nombre} />
    </div>
  );
}

function VitrinaProducto({ config, subdominio, carrito, producto, varianteSeleccionada, onSeleccionarVariante, cantidad, onCantidadChange, onAgregar }: PropsProducto) {
  const { tema, nombre, logo } = config;
  const { modo } = useTiendaTema();
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  const debeElegirVariante = producto.variantes.length > 1;
  const galeria = [producto.imagen, ...producto.imagenesAdicionales].filter((img): img is string => !!img);
  const [imagenActiva, setImagenActiva] = useState(galeria[0] ?? null);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS, modo), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="mx-auto grid max-w-4xl gap-10 px-6 py-10 sm:grid-cols-2 sm:px-10">
        <div>
          <div className="overflow-hidden bg-[var(--tienda-color-superficie)] p-3" style={{ aspectRatio: 'var(--tienda-ratio-imagen)', borderRadius: 'var(--tienda-radio-tarjeta)', boxShadow: 'var(--tienda-sombra-tarjeta)' }}>
            <ThumbVitrina imagen={imagenActiva} nombre={producto.nombre} />
          </div>
          {galeria.length > 1 && (
            <div className="mt-3 flex gap-2">
              {galeria.map((img, i) => (
                <button key={i} type="button" onClick={() => setImagenActiva(img)} className="h-14 w-14 overflow-hidden rounded-full border-2" style={{ borderColor: imagenActiva === img ? 'var(--tienda-color-acento)' : 'transparent' }}>
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="mb-2 text-[1.4em] font-extrabold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
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
                  className="flex items-center justify-between rounded-xl border px-3 py-2 text-left text-[0.85em] disabled:cursor-not-allowed disabled:opacity-40"
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
            disabled={!varianteSeleccionada || (varianteSeleccionada.stock !== null && varianteSeleccionada.stock <= 0)}
            className="rounded-full px-6 py-3 text-[0.85em] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--tienda-color-acento)' }}
          >
            Agregar al carrito
          </button>
        </div>
      </div>
      <ProductosRelacionados productos={producto.relacionados} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} estiloInsigniaSinStock={tema.estiloInsigniaSinStock} />
      <Footer nombre={nombre} />
    </div>
  );
}

function VitrinaCarrito({ config, subdominio, carrito }: PropsCarrito) {
  const { tema, nombre, logo } = config;
  const { modo } = useTiendaTema();
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS, modo), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <h1 className="mb-6 text-[1.4em] font-extrabold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          Tu carrito
        </h1>
        {carrito.items.length === 0 && <p className="text-[0.85em] opacity-60">Tu carrito está vacío.</p>}
        <div className="flex flex-col gap-4">
          {carrito.items.map((item) => (
            <div key={item.varianteId} className="flex items-center gap-4 bg-[var(--tienda-color-superficie)] p-3" style={{ borderRadius: 'var(--tienda-radio-tarjeta)', boxShadow: 'var(--tienda-sombra-tarjeta)' }}>
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl" style={{ background: 'color-mix(in srgb, var(--tienda-color-acento) 12%, var(--tienda-color-superficie))' }}>
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
            <p className="text-[1.1em] font-extrabold" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
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

export const vitrina: Plantilla = { Home: VitrinaHome, Producto: VitrinaProducto, Carrito: VitrinaCarrito };
