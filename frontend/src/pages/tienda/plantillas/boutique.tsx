import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
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
import type { Plantilla, PropsCarrito, PropsHome, PropsProducto } from './tipos';

// Boutique es oscura y sin tokens (Fase 7) — los componentes compartidos
// necesitan sus propios colores de respaldo para no quedar con una
// tarjeta blanca sobre este fondo casi negro (Directo/Mercado, claras,
// funcionan bien con el default de esos componentes).
const DEFAULTS_COMPARTIDOS = { superficie: '#2b241e', texto: '#f4ede3' };

const ACCENT_DEFAULT = '#c9a27e';
const FONT_DISPLAY = "'Cormorant Garamond', serif";
const FONT_BODY = "'Jost', sans-serif";

function Nav({ nombre, logo, subdominio, cantidadCarrito, accent }: { nombre: string; logo: string | null; subdominio: string; cantidadCarrito: number; accent: string }) {
  const { autenticado } = useClienteTienda(subdominio);
  const { abrir } = useCarritoDrawer();
  return (
    <div className="flex items-center justify-between border-b border-[#37312a] px-8 py-5 sm:px-12">
      <Link to={`/tienda/${subdominio}`} className="flex items-center gap-2 text-[#f4ede3]" style={{ fontFamily: FONT_DISPLAY }}>
        {logo && <img src={logo} alt={nombre} className="h-8 w-8 rounded-full object-cover" />}
        <span className="text-2xl font-semibold tracking-wide">{nombre}</span>
      </Link>
      <div className="flex items-center gap-6">
        <Link to={`/tienda/${subdominio}/${autenticado ? 'mis-pedidos' : 'login'}`} className="text-[11px] font-semibold uppercase tracking-widest text-[#bdb2a1]">
          {autenticado ? 'Mi cuenta' : 'Iniciar sesión'}
        </Link>
        <button type="button" onClick={abrir} className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: accent }}>
          Bolsa ({cantidadCarrito})
        </button>
      </div>
    </div>
  );
}

function Footer({ nombre }: { nombre: string }) {
  return (
    <div className="flex justify-between border-t border-[#37312a] px-8 py-6 text-[10px] uppercase tracking-widest text-[#8a8073] sm:px-12">
      <span>© {nombre}</span>
      <span>Sistema del Sol</span>
    </div>
  );
}

function BoutiqueHome({ config, subdominio, carrito, productos, cargando, busqueda, onBuscar }: PropsHome) {
  const accent = config.colorAcento || ACCENT_DEFAULT;
  const { data: destacados = [] } = useProductosDestacados(subdominio);
  const { data: ofertas = [] } = useOfertasTienda(subdominio);
  const { data: secciones = [] } = useSeccionesTienda(subdominio);
  return (
    <div className="min-h-screen bg-[#211d19] text-[#f4ede3]" style={{ fontFamily: FONT_BODY }}>
      <BannerAnuncio mensajes={config.bannerAnuncio.mensajes} intervaloSegundos={config.bannerAnuncio.intervaloSegundos} colorAcento={accent} />
      <Nav nombre={config.nombre} logo={config.logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} accent={accent} />

      <div className="px-8 py-16 text-center sm:py-20">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em]" style={{ color: accent }}>
          Colección
        </div>
        <h1 className="mx-auto my-4 max-w-xl text-4xl font-semibold sm:text-5xl" style={{ fontFamily: FONT_DISPLAY }}>
          {config.nombre}
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-[#bdb2a1]">Piezas seleccionadas, disponibilidad real.</p>
      </div>

      <div className="mx-auto mb-8 flex max-w-xs items-center justify-center">
        <div className="relative w-full">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8073]" />
          <input
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar…"
            className="w-full border border-[#37312a] bg-transparent py-2 pl-8 pr-3 text-center text-xs uppercase tracking-widest text-[#f4ede3] outline-none placeholder:text-[#8a8073]"
          />
        </div>
      </div>

      <SeccionDestacados
        productos={destacados}
        subdominio={subdominio}
        defaults={{ acento: accent, ...DEFAULTS_COMPARTIDOS }}
        estiloInsignia={config.tema.estiloInsigniaOferta}
        estiloInsigniaSinStock={config.tema.estiloInsigniaSinStock}
      />
      <SeccionOfertas ofertas={ofertas} defaults={{ acento: accent, ...DEFAULTS_COMPARTIDOS }} mostrar={config.tema.mostrarSeccionOfertas} />
      <SeccionesDinamicas
        secciones={secciones}
        subdominio={subdominio}
        defaults={{ acento: accent, ...DEFAULTS_COMPARTIDOS }}
        estiloInsignia={config.tema.estiloInsigniaOferta}
        estiloInsigniaSinStock={config.tema.estiloInsigniaSinStock}
      />

      {cargando && <p className="pb-16 text-center text-sm text-[#8a8073]">Cargando…</p>}
      {!cargando && productos.length === 0 && <p className="pb-16 text-center text-sm text-[#8a8073]">No hay productos.</p>}
      {productos.length > 0 && (
        <div className="grid grid-cols-2 gap-px bg-[#37312a] px-8 pb-16 sm:grid-cols-3 sm:px-12">
          {productos.map((p) => (
            <Link key={p.id} to={`/tienda/${subdominio}/producto/${p.id}`} className="bg-[#211d19] pb-4">
              <div className={`relative aspect-[4/5] ${claseImagenSinStock(p.sinStock, config.tema.estiloInsigniaSinStock)}`} style={{ background: 'linear-gradient(160deg,#3a332b,#211d19)' }}>
                {p.imagen && <img src={p.imagen} alt={p.nombre} className="h-full w-full object-cover" />}
                {p.sinStock ? (
                  <InsigniaSinStock sinStock estilo={config.tema.estiloInsigniaSinStock} />
                ) : (
                  <InsigniaOferta oferta={p.oferta} estilo={config.tema.estiloInsigniaOferta} colorAcento={accent} colorSuperficie={DEFAULTS_COMPARTIDOS.superficie} />
                )}
              </div>
              <div className="px-3 pt-4 text-center">
                {p.categoria && <div className="text-[10px] uppercase tracking-widest text-[#8a8073]">{p.categoria.nombre}</div>}
                <h3 className="my-1.5 text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY }}>
                  {p.nombre}
                </h3>
                <p className="text-sm tracking-wide">
                  <FilaPrecioOferta precio={p.precio} oferta={p.sinStock ? null : p.oferta} estilo={config.tema.estiloInsigniaOferta} tamano="1em" colorAcento={accent} />
                </p>
                <TextoSinStock sinStock={p.sinStock} estilo={config.tema.estiloInsigniaSinStock} />
                <button
                  type="button"
                  disabled={!p.tieneVariantes && p.sinStock}
                  onClick={(e) => {
                    if (p.tieneVariantes || !p.varianteId || p.sinStock) return;
                    e.preventDefault();
                    carrito.agregar({
                      productoId: p.id,
                      varianteId: p.varianteId,
                      varianteEtiqueta: '',
                      nombre: p.nombre,
                      precio: precioParaCarrito(p.precio, p.oferta), precioOriginal: precioOriginalParaCarrito(p.precio, p.oferta),
                      imagen: p.imagen,
                    });
                  }}
                  className="mt-3 border px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: accent, color: accent }}
                >
                  {!p.tieneVariantes && p.sinStock ? 'Agotado' : p.tieneVariantes ? 'Ver opciones' : 'Agregar'}
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Footer nombre={config.nombre} />
    </div>
  );
}

function BoutiqueProducto({ config, subdominio, carrito, producto, varianteSeleccionada, onSeleccionarVariante, cantidad, onCantidadChange, onAgregar }: PropsProducto) {
  const accent = config.colorAcento || ACCENT_DEFAULT;
  const debeElegirVariante = producto.variantes.length > 1;
  const galeria = [producto.imagen, ...producto.imagenesAdicionales].filter((img): img is string => !!img);
  const [imagenActiva, setImagenActiva] = useState(galeria[0] ?? null);
  return (
    <div className="min-h-screen bg-[#211d19] text-[#f4ede3]" style={{ fontFamily: FONT_BODY }}>
      <Nav nombre={config.nombre} logo={config.logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} accent={accent} />
      <div className="mx-auto grid max-w-4xl gap-10 px-8 py-14 sm:grid-cols-2 sm:px-12">
        <div>
          <div className="aspect-[4/5]" style={{ background: 'linear-gradient(160deg,#3a332b,#211d19)' }}>
            {imagenActiva && <img src={imagenActiva} alt={producto.nombre} className="h-full w-full object-cover" />}
          </div>
          {galeria.length > 1 && (
            <div className="mt-3 flex justify-center gap-2 sm:justify-start">
              {galeria.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImagenActiva(img)}
                  className="h-14 w-14 overflow-hidden border"
                  style={{ borderColor: imagenActiva === img ? accent : '#37312a' }}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="text-center sm:text-left">
          {producto.categoria && <div className="text-[10px] uppercase tracking-widest text-[#8a8073]">{producto.categoria.nombre}</div>}
          <h1 className="my-3 text-3xl font-semibold" style={{ fontFamily: FONT_DISPLAY }}>
            {producto.nombre}
          </h1>
          <div className="mb-4 tracking-wide">
            {varianteSeleccionada ? (
              <FilaPrecioOferta precio={varianteSeleccionada.precio} oferta={varianteSeleccionada.oferta} estilo={config.tema.estiloInsigniaOferta} tamano="1.25em" colorAcento={accent} />
            ) : (
              <p className="text-xl" style={{ color: accent }}>Elegí una opción</p>
            )}
          </div>
          {producto.descripcionTienda && <p className="mb-5 text-sm leading-relaxed text-[#bdb2a1]">{producto.descripcionTienda}</p>}

          {debeElegirVariante && (
            <div className="mb-6 flex flex-col gap-2">
              {producto.variantes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSeleccionarVariante(v.id)}
                  disabled={v.stock !== null && v.stock <= 0}
                  className="flex items-center justify-between border px-4 py-2 text-left text-sm uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: varianteSeleccionada?.id === v.id ? accent : '#37312a', color: varianteSeleccionada?.id === v.id ? accent : '#f4ede3' }}
                >
                  <span className="flex flex-col normal-case">
                    <span>{v.etiqueta || '(sin atributos)'}</span>
                    {v.stock !== null &&
                      (v.stock > 0 ? (
                        <span className="text-[10px] uppercase tracking-widest text-[#8a8073]">{v.stock} disponibles</span>
                      ) : (
                        <EtiquetaSinExistenciaVariante estilo={config.tema.estiloInsigniaSinStock} />
                      ))}
                  </span>
                  <span>{formatearPrecio(v.precio)}</span>
                </button>
              ))}
            </div>
          )}

          {varianteSeleccionada && varianteSeleccionada.stock !== null && (
            <p className="mb-6 text-xs uppercase tracking-widest text-[#8a8073]">
              {varianteSeleccionada.stock > 0 ? `${varianteSeleccionada.stock} disponibles` : <EtiquetaSinExistenciaVariante estilo={config.tema.estiloInsigniaSinStock} />}
            </p>
          )}
          <div className="mb-6 flex items-center justify-center gap-3 sm:justify-start">
            <button type="button" onClick={() => onCantidadChange(Math.max(1, cantidad - 1))} className="flex h-9 w-9 items-center justify-center border border-[#37312a]">
              <Minus size={14} />
            </button>
            <span className="w-6 text-center">{cantidad}</span>
            <button type="button" onClick={() => onCantidadChange(cantidad + 1)} className="flex h-9 w-9 items-center justify-center border border-[#37312a]">
              <Plus size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={onAgregar}
            disabled={!varianteSeleccionada || (varianteSeleccionada.stock !== null && varianteSeleccionada.stock <= 0)}
            className="border px-8 py-3 text-[11px] font-semibold uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: accent, color: accent }}
          >
            Agregar a la bolsa
          </button>
        </div>
      </div>
      <ProductosRelacionados
        productos={producto.relacionados}
        subdominio={subdominio}
        defaults={{ acento: accent, ...DEFAULTS_COMPARTIDOS }}
        estiloInsignia={config.tema.estiloInsigniaOferta}
        estiloInsigniaSinStock={config.tema.estiloInsigniaSinStock}
      />
      <Footer nombre={config.nombre} />
    </div>
  );
}

function BoutiqueCarrito({ config, subdominio, carrito }: PropsCarrito) {
  const accent = config.colorAcento || ACCENT_DEFAULT;
  return (
    <div className="min-h-screen bg-[#211d19] text-[#f4ede3]" style={{ fontFamily: FONT_BODY }}>
      <Nav nombre={config.nombre} logo={config.logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} accent={accent} />
      <div className="mx-auto max-w-2xl px-8 py-14 sm:px-12">
        <h1 className="mb-8 text-center text-3xl font-semibold" style={{ fontFamily: FONT_DISPLAY }}>
          Tu bolsa
        </h1>
        {carrito.items.length === 0 && <p className="text-center text-sm text-[#8a8073]">Tu bolsa está vacía.</p>}
        <div className="flex flex-col gap-4">
          {carrito.items.map((item) => (
            <div key={item.varianteId} className="flex items-center gap-4 border border-[#37312a] p-3">
              <div className="h-16 w-16 shrink-0" style={{ background: 'linear-gradient(160deg,#3a332b,#211d19)' }}>
                {item.imagen && <img src={item.imagen} alt={item.nombre} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ fontFamily: FONT_DISPLAY }}>
                  {item.nombre}
                </p>
                {item.varianteEtiqueta && <p className="text-xs uppercase tracking-wide text-[#8a8073]">{item.varianteEtiqueta}</p>}
                <p className="text-xs uppercase tracking-wide text-[#8a8073]">{formatearPrecio(item.precio)} c/u</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad - 1)} className="flex h-7 w-7 items-center justify-center border border-[#37312a]">
                  <Minus size={12} />
                </button>
                <span className="w-5 text-center text-sm">{item.cantidad}</span>
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad + 1)} className="flex h-7 w-7 items-center justify-center border border-[#37312a]">
                  <Plus size={12} />
                </button>
              </div>
              <span className="w-20 text-right text-sm" style={{ color: accent }}>
                {formatearPrecio(item.precio * item.cantidad)}
              </span>
              <button type="button" onClick={() => carrito.quitar(item.varianteId)} className="text-[#8a8073] hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        {carrito.items.length > 0 && (
          <div className="mt-8 flex flex-col items-center gap-4 border-t border-[#37312a] pt-8 sm:items-end">
            <p className="text-xl font-semibold" style={{ fontFamily: FONT_DISPLAY }}>
              Total: {formatearPrecio(carrito.total)}
            </p>
            <Link to={`/tienda/${subdominio}/checkout`} className="border px-8 py-3 text-[11px] font-semibold uppercase tracking-widest" style={{ borderColor: accent, color: accent }}>
              Finalizar compra
            </Link>
          </div>
        )}
      </div>
      <Footer nombre={config.nombre} />
    </div>
  );
}

export const boutique: Plantilla = { Home: BoutiqueHome, Producto: BoutiqueProducto, Carrito: BoutiqueCarrito };
