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
import type { Plantilla, PropsCarrito, PropsHome, PropsProducto } from './tipos';

const ACCENT_DEFAULT = '#c77d2e';
const FONT_DISPLAY = "'Manrope', sans-serif";
const FONT_BODY = "'Karla', sans-serif";

function Nav({ nombre, logo, subdominio, cantidadCarrito, accent }: { nombre: string; logo: string | null; subdominio: string; cantidadCarrito: number; accent: string }) {
  const { autenticado } = useClienteTienda(subdominio);
  const { abrir } = useCarritoDrawer();
  return (
    <div className="flex items-center justify-between border-b border-[#eae3d6] px-6 py-4 dark:border-[#332c22] sm:px-10">
      <Link to={`/tienda/${subdominio}`} className="flex items-center gap-2" style={{ fontFamily: FONT_DISPLAY }}>
        {logo && <img src={logo} alt={nombre} className="h-8 w-8 rounded object-cover" />}
        <span className="text-lg font-extrabold tracking-tight text-[#1c1a17] dark:text-[#f1ece2]">{nombre}</span>
      </Link>
      <div className="flex items-center gap-5">
        <Link
          to={`/tienda/${subdominio}/${autenticado ? 'mis-pedidos' : 'login'}`}
          className="flex items-center gap-1.5 text-sm font-bold text-[#1c1a17] dark:text-[#f1ece2]"
        >
          <User size={16} />
          {autenticado ? 'Mi cuenta' : 'Iniciar sesión'}
        </Link>
        <button type="button" onClick={abrir} className="flex items-center gap-2 text-sm font-bold text-[#1c1a17] dark:text-[#f1ece2]">
          <ShoppingCart size={18} />
          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: accent }}>
            {cantidadCarrito}
          </span>
        </button>
      </div>
    </div>
  );
}

function Footer({ nombre }: { nombre: string }) {
  return (
    <div className="flex justify-between border-t border-[#eae3d6] px-6 py-6 text-xs text-[#7a7266] dark:border-[#332c22] sm:px-10">
      <span>© {nombre}</span>
      <span>Powered by Sistema del Sol</span>
    </div>
  );
}

function DirectoHome({ config, subdominio, carrito, productos, cargando, busqueda, onBuscar }: PropsHome) {
  const accent = config.colorAcento || ACCENT_DEFAULT;
  const { data: destacados = [] } = useProductosDestacados(subdominio);
  const { data: ofertas = [] } = useOfertasTienda(subdominio);
  const { data: secciones = [] } = useSeccionesTienda(subdominio);
  return (
    <div className="min-h-screen bg-[#faf7f2] font-['Karla'] text-[#1c1a17] dark:bg-[#17140f] dark:text-[#f1ece2]" style={{ fontFamily: FONT_BODY }}>
      <BannerAnuncio texto={config.bannerTexto} />
      <Nav nombre={config.nombre} logo={config.logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} accent={accent} />

      <div className="max-w-xl px-6 pb-14 pt-16 sm:px-10">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
          Bienvenido
        </div>
        <h1 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight" style={{ fontFamily: FONT_DISPLAY }}>
          {config.nombre}
        </h1>
        <p className="text-sm leading-relaxed text-[#7a7266] dark:text-[#b6ab97]">Todo el surtido, con precio y disponibilidad reales.</p>
      </div>

      <SeccionDestacados productos={destacados} subdominio={subdominio} estiloInsignia={config.tema.estiloInsigniaOferta} />
      <SeccionOfertas ofertas={ofertas} mostrar={config.tema.mostrarSeccionOfertas} />
      <SeccionesDinamicas secciones={secciones} subdominio={subdominio} estiloInsignia={config.tema.estiloInsigniaOferta} />

      <div className="flex items-baseline justify-between px-6 pb-4 sm:px-10">
        <h2 className="text-lg font-extrabold" style={{ fontFamily: FONT_DISPLAY }}>
          Productos
        </h2>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7a7266]" />
          <input
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar producto…"
            className="rounded-lg border border-[#eae3d6] bg-white py-2 pl-8 pr-3 text-xs outline-none dark:border-[#332c22] dark:bg-[#1f1b15]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 pb-16 sm:grid-cols-3 sm:px-10 lg:grid-cols-4">
        {cargando && <p className="col-span-full text-sm text-[#7a7266]">Cargando…</p>}
        {!cargando && productos.length === 0 && <p className="col-span-full text-sm text-[#7a7266]">No hay productos.</p>}
        {productos.map((p) => (
          <Link
            key={p.id}
            to={`/tienda/${subdominio}/producto/${p.id}`}
            className="overflow-hidden rounded-xl border border-[#eae3d6] bg-white dark:border-[#332c22] dark:bg-[#1f1b15]"
          >
            <div className="relative aspect-square bg-gradient-to-br from-[#f1e9da] to-[#e3d5ba]">
              {p.imagen && <img src={p.imagen} alt={p.nombre} className="h-full w-full object-cover" />}
              <InsigniaOferta oferta={p.oferta} estilo={config.tema.estiloInsigniaOferta} colorAcento={accent} />
            </div>
            <div className="p-3">
              {p.categoria && <div className="text-[10px] font-bold uppercase tracking-wide text-[#7a7266]">{p.categoria.nombre}</div>}
              <h3 className="my-1.5 text-sm font-semibold">{p.nombre}</h3>
              <div className="flex items-center justify-between gap-1.5">
                {p.oferta ? (
                  <span style={{ fontFamily: FONT_DISPLAY }}>
                    <FilaPrecioOferta precio={p.precio} oferta={p.oferta} estilo={config.tema.estiloInsigniaOferta} tamano="0.875em" colorAcento={accent} />
                  </span>
                ) : (
                  <span className="text-sm font-extrabold" style={{ fontFamily: FONT_DISPLAY }}>
                    {formatearPrecio(p.precio)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    // Con más de una variante (talla/color), no hay forma de saber cuál sin ir al detalle — se deja navegar el <Link>.
                    if (p.tieneVariantes || !p.varianteId) return;
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
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                  style={{ background: accent }}
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

function DirectoProducto({ config, subdominio, carrito, producto, varianteSeleccionada, onSeleccionarVariante, cantidad, onCantidadChange, onAgregar }: PropsProducto) {
  const accent = config.colorAcento || ACCENT_DEFAULT;
  const debeElegirVariante = producto.variantes.length > 1;
  const galeria = [producto.imagen, ...producto.imagenesAdicionales].filter((img): img is string => !!img);
  const [imagenActiva, setImagenActiva] = useState(galeria[0] ?? null);
  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#1c1a17] dark:bg-[#17140f] dark:text-[#f1ece2]" style={{ fontFamily: FONT_BODY }}>
      <Nav nombre={config.nombre} logo={config.logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} accent={accent} />
      <div className="mx-auto grid max-w-4xl gap-8 px-6 py-12 sm:grid-cols-2 sm:px-10">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-[#f1e9da] to-[#e3d5ba]">
            {imagenActiva && <img src={imagenActiva} alt={producto.nombre} className="h-full w-full object-cover" />}
          </div>
          {galeria.length > 1 && (
            <div className="mt-3 flex gap-2">
              {galeria.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImagenActiva(img)}
                  className="h-14 w-14 overflow-hidden rounded-lg border"
                  style={{ borderColor: imagenActiva === img ? accent : '#eae3d6' }}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          {producto.categoria && <div className="text-xs font-bold uppercase tracking-wide text-[#7a7266]">{producto.categoria.nombre}</div>}
          <h1 className="my-2 text-2xl font-extrabold" style={{ fontFamily: FONT_DISPLAY }}>
            {producto.nombre}
          </h1>
          <div className="mb-4" style={{ fontFamily: FONT_DISPLAY }}>
            {varianteSeleccionada ? (
              <FilaPrecioOferta precio={varianteSeleccionada.precio} oferta={varianteSeleccionada.oferta} estilo={config.tema.estiloInsigniaOferta} tamano="1.5em" colorAcento={accent} />
            ) : (
              <p className="text-2xl font-extrabold" style={{ color: accent }}>Elegí una opción</p>
            )}
          </div>
          {producto.descripcionTienda && <p className="mb-5 text-sm leading-relaxed text-[#7a7266] dark:text-[#b6ab97]">{producto.descripcionTienda}</p>}

          {debeElegirVariante && (
            <div className="mb-5 flex flex-col gap-2">
              {producto.variantes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSeleccionarVariante(v.id)}
                  disabled={v.stock !== null && v.stock <= 0}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                    varianteSeleccionada?.id === v.id ? 'border-current' : 'border-[#eae3d6] dark:border-[#332c22]'
                  }`}
                  style={varianteSeleccionada?.id === v.id ? { color: accent, borderColor: accent } : undefined}
                >
                  <span className="flex flex-col text-[#1c1a17] dark:text-[#f1ece2]">
                    <span>{v.etiqueta || '(sin atributos)'}</span>
                    {v.stock !== null && (
                      <span className="text-xs text-[#7a7266]">{v.stock > 0 ? `${v.stock} disponibles` : 'Sin existencia'}</span>
                    )}
                  </span>
                  <span className="font-bold" style={{ color: accent }}>
                    {formatearPrecio(v.precio)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {varianteSeleccionada && varianteSeleccionada.stock !== null && (
            <p className="mb-6 text-sm text-[#7a7266]">{varianteSeleccionada.stock > 0 ? `${varianteSeleccionada.stock} disponibles` : 'Sin stock'}</p>
          )}
          <div className="mb-5 flex items-center gap-3">
            <button type="button" onClick={() => onCantidadChange(Math.max(1, cantidad - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#eae3d6] dark:border-[#332c22]">
              <Minus size={14} />
            </button>
            <span className="w-6 text-center font-semibold">{cantidad}</span>
            <button type="button" onClick={() => onCantidadChange(cantidad + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#eae3d6] dark:border-[#332c22]">
              <Plus size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={onAgregar}
            disabled={!varianteSeleccionada}
            className="rounded-lg px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: accent }}
          >
            Agregar al carrito
          </button>
        </div>
      </div>
      <ProductosRelacionados productos={producto.relacionados} subdominio={subdominio} estiloInsignia={config.tema.estiloInsigniaOferta} />
      <Footer nombre={config.nombre} />
    </div>
  );
}

function DirectoCarrito({ config, subdominio, carrito }: PropsCarrito) {
  const accent = config.colorAcento || ACCENT_DEFAULT;
  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#1c1a17] dark:bg-[#17140f] dark:text-[#f1ece2]" style={{ fontFamily: FONT_BODY }}>
      <Nav nombre={config.nombre} logo={config.logo} subdominio={subdominio} cantidadCarrito={carrito.cantidadTotal} accent={accent} />
      <div className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <h1 className="mb-6 text-2xl font-extrabold" style={{ fontFamily: FONT_DISPLAY }}>
          Tu carrito
        </h1>
        {carrito.items.length === 0 && <p className="text-sm text-[#7a7266]">Tu carrito está vacío.</p>}
        <div className="flex flex-col gap-4">
          {carrito.items.map((item) => (
            <div key={item.varianteId} className="flex items-center gap-4 rounded-xl border border-[#eae3d6] bg-white p-3 dark:border-[#332c22] dark:bg-[#1f1b15]">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-[#f1e9da] to-[#e3d5ba]">
                {item.imagen && <img src={item.imagen} alt={item.nombre} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{item.nombre}</p>
                {item.varianteEtiqueta && <p className="text-xs text-[#7a7266]">{item.varianteEtiqueta}</p>}
                <p className="text-xs text-[#7a7266]">{formatearPrecio(item.precio)} c/u</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#eae3d6] dark:border-[#332c22]">
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center text-sm">{item.cantidad}</span>
                <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#eae3d6] dark:border-[#332c22]">
                  <Plus size={13} />
                </button>
              </div>
              <span className="w-20 text-right text-sm font-bold">{formatearPrecio(item.precio * item.cantidad)}</span>
              <button type="button" onClick={() => carrito.quitar(item.varianteId)} className="text-[#7a7266] hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        {carrito.items.length > 0 && (
          <div className="mt-8 flex flex-col items-end gap-3 border-t border-[#eae3d6] pt-6 dark:border-[#332c22]">
            <p className="text-lg font-extrabold" style={{ fontFamily: FONT_DISPLAY }}>
              Total: {formatearPrecio(carrito.total)}
            </p>
            <Link to={`/tienda/${subdominio}/checkout`} className="rounded-lg px-6 py-3 text-sm font-bold text-white" style={{ background: accent }}>
              Finalizar compra
            </Link>
          </div>
        )}
      </div>
      <Footer nombre={config.nombre} />
    </div>
  );
}

export const directo: Plantilla = { Home: DirectoHome, Producto: DirectoProducto, Carrito: DirectoCarrito };
