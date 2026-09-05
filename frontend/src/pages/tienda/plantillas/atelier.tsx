import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, User } from 'lucide-react';
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

// Fase 8 — alta costura minimalista: lujo silencioso, blanco/negro absoluto,
// una sola foto grande por pieza, cero ruido visual. Un paso más arriba
// que Boutique en contención.
const DEFAULTS: DefaultsTemaPlantilla = {
  colorAcento: '#b8a06a',
  colorFondo: '#ffffff',
  colorSuperficie: '#ffffff',
  colorTexto: '#0a0a0a',
  fuenteDisplay: 'Cormorant',
  fuenteBody: 'DM Sans',
};

const ENLACES_MENU: Record<ClaveMenuTienda, { label: string; href: (subdominio: string) => string }> = {
  inicio: { label: 'Colección', href: (s) => `/tienda/${s}` },
  categorias: { label: 'Archivo', href: (s) => `/tienda/${s}/productos` },
  carrito: { label: 'Bolsa', href: (s) => `/tienda/${s}/carrito` },
  cuenta: { label: 'Cuenta', href: (s) => `/tienda/${s}/mis-pedidos` },
};

function Nav({ nombre, logo, subdominio, cantidadCarrito, menu }: { nombre: string; logo: string | null; subdominio: string; cantidadCarrito: number; menu: ClaveMenuTienda[] }) {
  const { autenticado } = useClienteTienda(subdominio);
  const { abrir } = useCarritoDrawer();
  return (
    <div className="flex flex-wrap items-center justify-between gap-y-2 px-6 py-6 sm:px-10">
      <Link to={`/tienda/${subdominio}`} className="flex items-center gap-2 tracking-[0.03em]" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
        {logo && <img src={logo} alt={nombre} className="h-7 w-auto max-w-[7rem] object-contain" />}
        <span className="text-[1.3em] font-medium text-[var(--tienda-color-texto)]">{nombre}</span>
      </Link>
      <div className="flex flex-wrap items-center gap-3 gap-y-2 sm:gap-7">
        {menu.map((clave) => {
          if (clave === 'cuenta') {
            return (
              <Link key={clave} to={autenticado ? ENLACES_MENU.cuenta.href(subdominio) : `/tienda/${subdominio}/login`} className="flex items-center gap-1.5 text-[0.68em] uppercase tracking-[0.1em] text-[var(--tienda-color-texto)] opacity-60">
                <User size={13} />
                {autenticado ? 'Cuenta' : 'Acceder'}
              </Link>
            );
          }
          if (clave === 'carrito') {
            return (
              <button key={clave} type="button" onClick={abrir} className="flex items-center gap-1.5 text-[0.68em] uppercase tracking-[0.1em] text-[var(--tienda-color-texto)]">
                <ShoppingCart size={13} />({cantidadCarrito})
              </button>
            );
          }
          return (
            <Link key={clave} to={ENLACES_MENU[clave].href(subdominio)} className="text-[0.68em] uppercase tracking-[0.1em] text-[var(--tienda-color-texto)] opacity-60">
              {ENLACES_MENU[clave].label}
            </Link>
          );
        })}
        <ToggleTemaTienda className="text-[var(--tienda-color-texto)] opacity-60" />
      </div>
    </div>
  );
}

function Footer({ nombre }: { nombre: string }) {
  return (
    <div className="flex justify-between px-6 py-8 text-[0.68em] uppercase tracking-[0.05em] opacity-40 sm:px-10">
      <span>© {nombre}</span>
      <span>Powered by Sistema del Sol</span>
    </div>
  );
}

function AtelierHome({ config, subdominio, carrito }: PropsHome) {
  const { tema, nombre, logo } = config;
  const { modo } = useTiendaTema();
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  const { data: destacados } = useProductosDestacados(subdominio);
  const { data: ofertas } = useOfertasTienda(subdominio);
  const { data: secciones = [] } = useSeccionesTienda(subdominio);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS, modo), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <BannerAnuncio mensajes={config.bannerAnuncio.mensajes} intervaloSegundos={config.bannerAnuncio.intervaloSegundos} />
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="px-6 pb-4 pt-2 sm:px-10">
        <div className="mb-2 text-[0.65em] uppercase tracking-[0.14em]" style={{ color: 'var(--tienda-color-acento)' }}>
          Colección actual
        </div>
        <h1 className="max-w-sm text-[1.9em] font-medium leading-tight" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          {nombre}
        </h1>
      </div>

      <SeccionDestacados productos={destacados ?? []} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} estiloInsigniaSinStock={tema.estiloInsigniaSinStock} />
      <SeccionOfertas ofertas={ofertas ?? []} mostrar={tema.mostrarSeccionOfertas} />
      <SeccionesDinamicas secciones={secciones} subdominio={subdominio} estiloInsignia={tema.estiloInsigniaOferta} estiloInsigniaSinStock={tema.estiloInsigniaSinStock} />
      <Footer nombre={nombre} />
    </div>
  );
}

function AtelierProducto({ config, subdominio, carrito, producto, varianteSeleccionada, onSeleccionarVariante, cantidad, onCantidadChange, onAgregar }: PropsProducto) {
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
      <div className="mx-auto grid max-w-4xl gap-12 px-6 py-10 sm:grid-cols-2 sm:px-10">
        <div>
          <div className="overflow-hidden" style={{ aspectRatio: 'var(--tienda-ratio-imagen)', background: 'linear-gradient(140deg,#efefef,#dcdcdc)' }}>
            {imagenActiva && <img src={imagenActiva} alt={producto.nombre} className="h-full w-full object-cover" />}
          </div>
          {galeria.length > 1 && (
            <div className="mt-3 flex gap-2">
              {galeria.map((img, i) => (
                <button key={i} type="button" onClick={() => setImagenActiva(img)} className="h-14 w-14 overflow-hidden border-2" style={{ borderColor: imagenActiva === img ? 'var(--tienda-color-acento)' : 'transparent' }}>
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="mb-3 text-[1.7em] font-medium" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
            {producto.nombre}
          </h1>
          <div className="mb-5">
            {varianteSeleccionada ? (
              <FilaPrecioOferta precio={varianteSeleccionada.precio} oferta={varianteSeleccionada.oferta} estilo={tema.estiloInsigniaOferta} tamano="1em" />
            ) : (
              <p className="text-[1em] opacity-70">Elegí una opción</p>
            )}
          </div>
          {producto.descripcionTienda && <p className="mb-6 text-[0.82em] leading-relaxed opacity-60">{producto.descripcionTienda}</p>}

          {debeElegirVariante && (
            <div className="mb-6 flex flex-col gap-2">
              {producto.variantes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSeleccionarVariante(v.id)}
                  disabled={v.stock !== null && v.stock <= 0}
                  className="flex items-center justify-between border-b px-1 py-2 text-left text-[0.8em] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: varianteSeleccionada?.id === v.id ? 'var(--tienda-color-texto)' : 'color-mix(in srgb, var(--tienda-color-texto) 12%, transparent)' }}
                >
                  <span className="flex flex-col">
                    <span>{v.etiqueta || '(sin atributos)'}</span>
                    {v.stock !== null &&
                      (v.stock > 0 ? (
                        <span className="text-[0.75em] opacity-50">{v.stock} disponibles</span>
                      ) : (
                        <EtiquetaSinExistenciaVariante estilo={tema.estiloInsigniaSinStock} />
                      ))}
                  </span>
                  <span>{formatearPrecio(v.precio)}</span>
                </button>
              ))}
            </div>
          )}

          {varianteSeleccionada && varianteSeleccionada.stock !== null && (
            <p className="mb-6 text-[0.8em] opacity-50">
              {varianteSeleccionada.stock > 0 ? `${varianteSeleccionada.stock} disponibles` : <EtiquetaSinExistenciaVariante estilo={tema.estiloInsigniaSinStock} />}
            </p>
          )}
          <div className="mb-6 flex items-center gap-3">
            <button type="button" onClick={() => onCantidadChange(Math.max(1, cantidad - 1))} className="flex h-8 w-8 items-center justify-center border border-[color:var(--tienda-color-texto)]/15">
              <Minus size={13} />
            </button>
            <span className="w-6 text-center">{cantidad}</span>
            <button type="button" onClick={() => onCantidadChange(cantidad + 1)} className="flex h-8 w-8 items-center justify-center border border-[color:var(--tienda-color-texto)]/15">
              <Plus size={13} />
            </button>
          </div>
          <button
            type="button"
            onClick={onAgregar}
            disabled={!varianteSeleccionada || (varianteSeleccionada.stock !== null && varianteSeleccionada.stock <= 0)}
            className="border border-[var(--tienda-color-texto)] px-6 py-3 text-[0.75em] uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40"
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

function AtelierCarrito({ config, subdominio, carrito }: PropsCarrito) {
  const { tema, nombre, logo } = config;
  const { modo } = useTiendaTema();
  useCargarFuentesTienda([tema.fuenteDisplay ?? DEFAULTS.fuenteDisplay, tema.fuenteBody ?? DEFAULTS.fuenteBody]);
  const menu = menuVisibleOrdenado(tema.menu);
  return (
    <div className="min-h-screen bg-[var(--tienda-color-fondo)] text-[var(--tienda-color-texto)]" style={{ ...variablesCssTema(tema, DEFAULTS, modo), fontFamily: 'var(--tienda-fuente-body)', fontSize: 'var(--tienda-tamano-fuente)' }}>
      <Nav nombre={nombre} logo={logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} menu={menu} />
      <div className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <h1 className="mb-8 text-[1.4em] font-medium" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
          Tu bolsa
        </h1>
        {carrito.items.length === 0 && <p className="text-[0.85em] opacity-50">Tu bolsa está vacía.</p>}
        <div className="flex flex-col gap-5">
          {carrito.items.map((item) => (
            <div key={item.varianteId} className="flex items-center gap-4 border-b border-[color:var(--tienda-color-texto)]/10 pb-5">
              <div className="h-16 w-16 shrink-0 overflow-hidden" style={{ background: '#eee' }}>
                {item.imagen && <img src={item.imagen} alt={item.nombre} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-[0.85em]">{item.nombre}</p>
                {item.varianteEtiqueta && <p className="text-[0.72em] opacity-50">{item.varianteEtiqueta}</p>}
                <p className="text-[0.72em] opacity-50">{formatearPrecio(item.precio)} c/u</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad - 1)} className="flex h-7 w-7 items-center justify-center border border-[color:var(--tienda-color-texto)]/15">
                  <Minus size={12} />
                </button>
                <span className="w-5 text-center text-[0.8em]">{item.cantidad}</span>
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad + 1)} className="flex h-7 w-7 items-center justify-center border border-[color:var(--tienda-color-texto)]/15">
                  <Plus size={12} />
                </button>
              </div>
              <span className="w-20 text-right text-[0.8em]">{formatearPrecio(item.precio * item.cantidad)}</span>
            </div>
          ))}
        </div>
        {carrito.items.length > 0 && (
          <div className="mt-8 flex flex-col items-end gap-3 pt-2">
            <p className="text-[1em]" style={{ fontFamily: 'var(--tienda-fuente-display)' }}>
              Total: {formatearPrecio(carrito.total)}
            </p>
            <Link to={`/tienda/${subdominio}/checkout`} className="border border-[var(--tienda-color-texto)] px-6 py-3 text-[0.75em] uppercase tracking-[0.08em]">
              Finalizar compra
            </Link>
          </div>
        )}
      </div>
      <Footer nombre={nombre} />
    </div>
  );
}

export const atelier: Plantilla = { Home: AtelierHome, Producto: AtelierProducto, Carrito: AtelierCarrito };
