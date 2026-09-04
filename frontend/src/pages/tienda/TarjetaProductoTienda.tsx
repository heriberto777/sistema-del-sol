import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ProductoTienda } from '../../hooks/useTienda';
import { useCarritoTiendaContext } from './CarritoTiendaContext';
import { FilaPrecioOferta, InsigniaOferta, precioOriginalParaCarrito, precioParaCarrito } from './OfertaEnTarjeta';
import { claseImagenSinStock, InsigniaSinStock, TextoSinStock } from './InsigniaSinStock';
import { EstiloInsigniaOfertaTienda, EstiloInsigniaSinStockTienda } from './tema';

/** Valores de respaldo cuando la plantilla no define tokens (Fase 7) — las 11 plantillas nuevas nunca los usan (su var() real siempre resuelve); Directo/Mercado (claras) funcionan bien con el default; Boutique (oscura) pasa los suyos explícitos para no quedar con una tarjeta blanca sobre fondo casi negro. */
export interface DefaultsColorTienda {
  acento?: string;
  superficie?: string;
  texto?: string;
}

const DEFAULT: Required<DefaultsColorTienda> = { acento: '#111827', superficie: '#ffffff', texto: 'inherit' };

/**
 * Tarjeta de producto compartida entre `SeccionDestacados` y
 * `ProductosRelacionados` (Fase 11) — mismo criterio de estilo que
 * `CarritoDrawer`: variables `--tienda-*` con fallback, para verse bien
 * tanto en las 11 plantillas con tokens como en las 3 viejas.
 */
export function TarjetaProductoTienda({
  producto,
  subdominio,
  defaults,
  estiloInsignia = 'CLASICO',
  estiloInsigniaSinStock = 'ETIQUETA',
}: {
  producto: ProductoTienda;
  subdominio: string;
  defaults?: DefaultsColorTienda;
  estiloInsignia?: EstiloInsigniaOfertaTienda;
  estiloInsigniaSinStock?: EstiloInsigniaSinStockTienda;
}) {
  const carrito = useCarritoTiendaContext();
  const d = { ...DEFAULT, ...defaults };
  return (
    <Link
      to={`/tienda/${subdominio}/producto/${producto.id}`}
      className="overflow-hidden"
      style={{
        borderRadius: 'var(--tienda-radio-tarjeta, 10px)',
        background: `var(--tienda-color-superficie, ${d.superficie})`,
        boxShadow: 'var(--tienda-sombra-tarjeta, 0 10px 24px -16px rgba(0,0,0,.25))',
      }}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: 'var(--tienda-ratio-imagen, 1/1)',
          background: `color-mix(in srgb, var(--tienda-color-acento, ${d.acento}) 15%, var(--tienda-color-superficie, ${d.superficie}))`,
        }}
      >
        {producto.imagen && (
          <img
            src={producto.imagen}
            alt={producto.nombre}
            className={`h-full w-full object-cover ${claseImagenSinStock(producto.sinStock, estiloInsigniaSinStock)}`}
          />
        )}
        {producto.sinStock ? (
          <InsigniaSinStock sinStock estilo={estiloInsigniaSinStock} />
        ) : (
          <InsigniaOferta oferta={producto.oferta} estilo={estiloInsignia} colorAcento={d.acento} colorSuperficie={d.superficie} />
        )}
      </div>
      <div className="p-3" style={{ color: `var(--tienda-color-texto, ${d.texto})` }}>
        <h3 className="mb-1 text-[0.85em] font-semibold">{producto.nombre}</h3>
        <div className="flex items-center justify-between gap-2">
          <FilaPrecioOferta precio={producto.precio} oferta={producto.sinStock ? null : producto.oferta} estilo={estiloInsignia} colorAcento={d.acento} />
          <TextoSinStock sinStock={producto.sinStock} estilo={estiloInsigniaSinStock} />
          {!producto.tieneVariantes && producto.varianteId && !producto.sinStock && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                carrito.agregar({
                  productoId: producto.id,
                  varianteId: producto.varianteId!,
                  varianteEtiqueta: '',
                  nombre: producto.nombre,
                  precio: precioParaCarrito(producto.precio, producto.oferta),
                  precioOriginal: precioOriginalParaCarrito(producto.precio, producto.oferta),
                  imagen: producto.imagen,
                });
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center text-white"
              style={{ borderRadius: 'var(--tienda-radio-tarjeta, 10px)', background: `var(--tienda-color-acento, ${d.acento})` }}
            >
              <Plus size={13} />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
