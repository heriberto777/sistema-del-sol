import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Search, ShoppingCart, Trash2, User } from 'lucide-react';
import { formatearPrecio } from '../../../hooks/useTienda';
import { useClienteTienda } from '../../../hooks/useClienteTienda';
import type { Plantilla, PropsCarrito, PropsHome, PropsProducto } from './tipos';

const ACCENT_DEFAULT = '#ff6b45';
const BG_OSCURO = '#0d5c58';
const FONT_DISPLAY = "'Fraunces', serif";
const FONT_BODY = "'Work Sans', sans-serif";

function Nav({ nombre, logo, subdominio, cantidadCarrito, accent }: { nombre: string; logo: string | null; subdominio: string; cantidadCarrito: number; accent: string }) {
  const { autenticado } = useClienteTienda(subdominio);
  return (
    <>
      <div className="py-1.5 text-center text-xs font-semibold text-white" style={{ background: BG_OSCURO }}>
        Powered by Sistema del Sol
      </div>
      <div className="flex items-center justify-between px-6 py-4 sm:px-10">
        <Link to={`/tienda/${subdominio}`} className="flex items-center gap-2" style={{ fontFamily: FONT_DISPLAY, color: BG_OSCURO }}>
          {logo && <img src={logo} alt={nombre} className="h-8 w-8 rounded-full object-cover" />}
          <span className="text-xl font-bold">{nombre}</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to={`/tienda/${subdominio}/${autenticado ? 'mis-pedidos' : 'login'}`} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: BG_OSCURO }}>
            <User size={16} />
            {autenticado ? 'Mi cuenta' : 'Iniciar sesión'}
          </Link>
          <Link
            to={`/tienda/${subdominio}/carrito`}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white"
            style={{ background: accent }}
          >
            <ShoppingCart size={15} />
            Carrito · {cantidadCarrito}
          </Link>
        </div>
      </div>
    </>
  );
}

function Footer({ nombre }: { nombre: string }) {
  return (
    <div className="flex justify-between px-6 py-6 text-xs text-[#cfe6e3] sm:px-10" style={{ background: BG_OSCURO }}>
      <span>© {nombre}</span>
      <span>Powered by Sistema del Sol</span>
    </div>
  );
}

function MercadoHome({ config, subdominio, carrito, productos, cargando, busqueda, onBuscar }: PropsHome) {
  const accent = config.colorAcento || ACCENT_DEFAULT;
  return (
    <div className="min-h-screen bg-[#fff6ec] text-[#0d5c58] dark:bg-[#0b1a19] dark:text-[#e7f3f1]" style={{ fontFamily: FONT_BODY }}>
      <Nav nombre={config.nombre} logo={config.logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} accent={accent} />

      <div className="mx-6 mb-10 grid gap-6 rounded-3xl p-8 text-white sm:mx-10 sm:grid-cols-2 sm:p-11" style={{ background: BG_OSCURO }}>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[#ffd9a8]">Fresco todos los días</div>
          <h1 className="my-3 text-3xl font-bold leading-tight sm:text-4xl" style={{ fontFamily: FONT_DISPLAY }}>
            {config.nombre}
          </h1>
          <p className="max-w-sm text-sm text-white/85">Pedí online y recibí en tu casa — mismos precios de siempre.</p>
        </div>
        {config.banner ? (
          <img src={config.banner} alt="" className="aspect-[4/3] rounded-2xl object-cover" />
        ) : (
          <div
            className="aspect-[4/3] rounded-2xl"
            style={{ background: 'repeating-linear-gradient(45deg,#12736e,#12736e 12px,#0d5c58 12px,#0d5c58 24px)' }}
          />
        )}
      </div>

      <div className="mx-6 mb-6 flex items-end justify-between sm:mx-10">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: FONT_DISPLAY }}>
            Catálogo
          </h2>
          <p className="text-xs text-[#7a8f8d]">{productos.length} producto(s)</p>
        </div>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7a8f8d]" />
          <input
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar…"
            className="rounded-full border-none bg-white py-2 pl-8 pr-4 text-xs shadow-sm outline-none dark:bg-[#12302e]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 px-6 pb-16 sm:grid-cols-3 sm:px-10 lg:grid-cols-4">
        {cargando && <p className="col-span-full text-sm text-[#7a8f8d]">Cargando…</p>}
        {!cargando && productos.length === 0 && <p className="col-span-full text-sm text-[#7a8f8d]">No hay productos.</p>}
        {productos.map((p) => (
          <Link key={p.id} to={`/tienda/${subdominio}/producto/${p.id}`} className="overflow-hidden rounded-2xl bg-white shadow-md dark:bg-[#12302e]">
            <div className="relative aspect-square" style={{ background: `linear-gradient(135deg,#ffd9a8,${accent})` }}>
              {p.imagen && <img src={p.imagen} alt={p.nombre} className="h-full w-full object-cover" />}
            </div>
            <div className="p-4">
              <h3 className="mb-2 text-sm font-semibold" style={{ fontFamily: FONT_DISPLAY }}>
                {p.nombre}
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: accent }}>
                  {formatearPrecio(p.precio)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    if (p.tieneVariantes || !p.varianteId) return;
                    e.preventDefault();
                    carrito.agregar({
                      productoId: p.id,
                      varianteId: p.varianteId,
                      varianteEtiqueta: '',
                      nombre: p.nombre,
                      precio: Number(p.precio ?? 0),
                      imagen: p.imagen,
                    });
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                  style={{ background: BG_OSCURO }}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Footer nombre={config.nombre} />
    </div>
  );
}

function MercadoProducto({ config, subdominio, carrito, producto, varianteSeleccionada, onSeleccionarVariante, cantidad, onCantidadChange, onAgregar }: PropsProducto) {
  const accent = config.colorAcento || ACCENT_DEFAULT;
  const debeElegirVariante = producto.variantes.length > 1;
  const galeria = [producto.imagen, ...producto.imagenesAdicionales].filter((img): img is string => !!img);
  const [imagenActiva, setImagenActiva] = useState(galeria[0] ?? null);
  return (
    <div className="min-h-screen bg-[#fff6ec] text-[#0d5c58] dark:bg-[#0b1a19] dark:text-[#e7f3f1]" style={{ fontFamily: FONT_BODY }}>
      <Nav nombre={config.nombre} logo={config.logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} accent={accent} />
      <div className="mx-auto grid max-w-4xl gap-8 px-6 py-12 sm:grid-cols-2 sm:px-10">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl" style={{ background: `linear-gradient(135deg,#ffd9a8,${accent})` }}>
            {imagenActiva && <img src={imagenActiva} alt={producto.nombre} className="h-full w-full object-cover" />}
          </div>
          {galeria.length > 1 && (
            <div className="mt-3 flex gap-2">
              {galeria.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImagenActiva(img)}
                  className="h-14 w-14 overflow-hidden rounded-xl"
                  style={{ boxShadow: imagenActiva === img ? `0 0 0 2px ${accent}` : undefined }}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          {producto.categoria && <div className="text-xs font-bold uppercase tracking-wide text-[#7a8f8d]">{producto.categoria.nombre}</div>}
          <h1 className="my-2 text-2xl font-bold" style={{ fontFamily: FONT_DISPLAY }}>
            {producto.nombre}
          </h1>
          <p className="mb-4 text-2xl font-bold" style={{ color: accent }}>
            {varianteSeleccionada ? formatearPrecio(varianteSeleccionada.precio) : 'Elegí una opción'}
          </p>
          {producto.descripcionTienda && <p className="mb-5 text-sm leading-relaxed text-[#4a6462] dark:text-[#a9c2bf]">{producto.descripcionTienda}</p>}

          {debeElegirVariante && (
            <div className="mb-5 flex flex-col gap-2">
              {producto.variantes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSeleccionarVariante(v.id)}
                  disabled={v.stock !== null && v.stock <= 0}
                  className={`flex items-center justify-between rounded-2xl bg-white px-4 py-2.5 text-left text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#12302e] ${
                    varianteSeleccionada?.id === v.id ? 'ring-2' : ''
                  }`}
                  style={varianteSeleccionada?.id === v.id ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
                >
                  <span className="flex flex-col">
                    <span>{v.etiqueta || '(sin atributos)'}</span>
                    {v.stock !== null && <span className="text-xs text-[#7a8f8d]">{v.stock > 0 ? `${v.stock} disponibles` : 'Sin existencia'}</span>}
                  </span>
                  <span className="font-bold" style={{ color: accent }}>
                    {formatearPrecio(v.precio)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {varianteSeleccionada && varianteSeleccionada.stock !== null && (
            <p className="mb-6 text-sm text-[#7a8f8d]">{varianteSeleccionada.stock > 0 ? `${varianteSeleccionada.stock} disponibles` : 'Sin stock'}</p>
          )}
          <div className="mb-5 flex items-center gap-3">
            <button type="button" onClick={() => onCantidadChange(Math.max(1, cantidad - 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm dark:bg-[#12302e]">
              <Minus size={14} />
            </button>
            <span className="w-6 text-center font-semibold">{cantidad}</span>
            <button type="button" onClick={() => onCantidadChange(cantidad + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm dark:bg-[#12302e]">
              <Plus size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={onAgregar}
            disabled={!varianteSeleccionada}
            className="rounded-full px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: accent }}
          >
            Agregar al carrito
          </button>
        </div>
      </div>
      <Footer nombre={config.nombre} />
    </div>
  );
}

function MercadoCarrito({ config, subdominio, carrito }: PropsCarrito) {
  const accent = config.colorAcento || ACCENT_DEFAULT;
  return (
    <div className="min-h-screen bg-[#fff6ec] text-[#0d5c58] dark:bg-[#0b1a19] dark:text-[#e7f3f1]" style={{ fontFamily: FONT_BODY }}>
      <Nav nombre={config.nombre} logo={config.logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} accent={accent} />
      <div className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <h1 className="mb-6 text-2xl font-bold" style={{ fontFamily: FONT_DISPLAY }}>
          Tu carrito
        </h1>
        {carrito.items.length === 0 && <p className="text-sm text-[#7a8f8d]">Tu carrito está vacío.</p>}
        <div className="flex flex-col gap-4">
          {carrito.items.map((item) => (
            <div key={item.varianteId} className="flex items-center gap-4 rounded-2xl bg-white p-3 shadow-sm dark:bg-[#12302e]">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl" style={{ background: `linear-gradient(135deg,#ffd9a8,${accent})` }}>
                {item.imagen && <img src={item.imagen} alt={item.nombre} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ fontFamily: FONT_DISPLAY }}>
                  {item.nombre}
                </p>
                {item.varianteEtiqueta && <p className="text-xs text-[#7a8f8d]">{item.varianteEtiqueta}</p>}
                <p className="text-xs text-[#7a8f8d]">{formatearPrecio(item.precio)} c/u</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad - 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff6ec] dark:bg-[#0b1a19]">
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center text-sm">{item.cantidad}</span>
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad + 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff6ec] dark:bg-[#0b1a19]">
                  <Plus size={13} />
                </button>
              </div>
              <span className="w-20 text-right text-sm font-bold" style={{ color: accent }}>
                {formatearPrecio(item.precio * item.cantidad)}
              </span>
              <button type="button" onClick={() => carrito.quitar(item.varianteId)} className="text-[#7a8f8d] hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        {carrito.items.length > 0 && (
          <div className="mt-8 flex flex-col items-end gap-3 border-t border-[#e6dccb] pt-6 dark:border-[#1e433f]">
            <p className="text-lg font-bold" style={{ fontFamily: FONT_DISPLAY }}>
              Total: {formatearPrecio(carrito.total)}
            </p>
            <Link to={`/tienda/${subdominio}/checkout`} className="rounded-full px-6 py-3 text-sm font-bold text-white" style={{ background: accent }}>
              Finalizar compra
            </Link>
          </div>
        )}
      </div>
      <Footer nombre={config.nombre} />
    </div>
  );
}

export const mercado: Plantilla = { Home: MercadoHome, Producto: MercadoProducto, Carrito: MercadoCarrito };
