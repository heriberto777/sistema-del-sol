import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { formatearPrecio, useTiendaConfig } from '../../hooks/useTienda';
import { useCarritoTiendaContext } from './CarritoTiendaContext';
import { useCarritoDrawer } from './CarritoDrawerContext';

const ACENTO_DEFAULT = '#111827';

/**
 * Shell neutro (blanco/slate) — deliberadamente sin piel por plantilla,
 * mismo criterio que `TiendaCheckout`/`TiendaMisPedidos` (paso utilitario,
 * no de marca). Se tiñe solo con `tema.colorAcento` para que el botón
 * principal y los precios reflejen el color real de la tienda, sin
 * arriesgar un fondo sin estilizar en Directo/Mercado/Boutique.
 */
export function CarritoDrawer({ subdominio }: { subdominio: string }) {
  const { abierto, cerrar } = useCarritoDrawer();
  const carrito = useCarritoTiendaContext();
  const { data: config } = useTiendaConfig(subdominio);
  const navigate = useNavigate();
  const acento = config?.tema.colorAcento ?? ACENTO_DEFAULT;

  useEffect(() => {
    if (!abierto) return undefined;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [abierto, cerrar]);

  if (!abierto || !config) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={cerrar} aria-hidden="true" />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <ShoppingBag size={18} />
            Tu carrito ({carrito.cantidadTotal})
          </h2>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {carrito.items.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Tu carrito está vacío.</p>}
          <div className="flex flex-col gap-4">
            {carrito.items.map((item) => (
              <div key={item.varianteId} className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {item.imagen && <img src={item.imagen} alt={item.nombre} className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.nombre}</p>
                  {item.varianteEtiqueta && <p className="text-xs text-slate-500 dark:text-slate-400">{item.varianteEtiqueta}</p>}
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad - 1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 dark:border-slate-600">
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-xs">{item.cantidad}</span>
                    <button type="button" onClick={() => carrito.actualizarCantidad(item.varianteId, item.cantidad + 1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 dark:border-slate-600">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatearPrecio(item.precio * item.cantidad)}</span>
                    {item.precioOriginal != null && (
                      <span className="text-xs text-slate-400 line-through dark:text-slate-500">{formatearPrecio(item.precioOriginal * item.cantidad)}</span>
                    )}
                  </span>
                  <button type="button" onClick={() => carrito.quitar(item.varianteId)} className="text-slate-400 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {carrito.items.length > 0 && (
          <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-slate-100">
              <span>Total</span>
              <span>{formatearPrecio(carrito.total)}</span>
            </div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">ITBIS incluido.</p>
            <button
              type="button"
              onClick={() => {
                cerrar();
                navigate(`/tienda/${subdominio}/checkout`);
              }}
              className="w-full rounded-lg py-3 text-center text-sm font-semibold text-white"
              style={{ background: acento }}
            >
              Finalizar compra
            </button>
            <button type="button" onClick={cerrar} className="mt-2 w-full text-center text-xs text-slate-500 dark:text-slate-400">
              Seguir comprando
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
