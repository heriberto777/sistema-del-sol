import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { PaginaResultado } from '../../../types/pagina-resultado';

export interface ProductoCatalogo {
  id: string;
  codigo: string;
  nombre: string;
  imagen: string | null;
  porcentajeItbis: string;
  tipo: 'PRODUCTO' | 'SERVICIO' | 'COMBO';
  precioVenta: string | null;
}

function formatoRD(valor: string) {
  return `RD$ ${Number(valor).toLocaleString('es-DO')}`;
}

/**
 * Grilla de productos con foto para el POS (Modelo C) — clic en una
 * tarjeta agrega al carrito, sin combobox+botón separados. Usa
 * `/productos/catalogo` (no `/productos`): ya trae la imagen y el precio
 * vigente en la misma respuesta, para no pedir el precio aparte por cada
 * producto como hacía la versión anterior. Chips de categoría (texto
 * libre, sin tabla propia — ver `/productos/categorias`) y un campo de
 * cantidad rápida permiten armar el carrito sin volver a tocar el mouse.
 */
export function CatalogoProductosPos({ onAgregar }: { onAgregar: (producto: ProductoCatalogo, cantidad: number) => void }) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState('1');
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data: categorias } = useQuery({
    queryKey: ['pos-categorias'],
    queryFn: async () => (await apiClient.get<string[]>('/productos/categorias')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['pos-catalogo', busquedaDebounced, categoria],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<ProductoCatalogo>>('/productos/catalogo', {
          params: { busqueda: busquedaDebounced || undefined, categoria: categoria ?? undefined, tamanoPagina: 24 },
        })
      ).data,
  });

  function agregar(producto: ProductoCatalogo) {
    const cantidadNumerica = Number(cantidad);
    onAgregar(producto, cantidadNumerica > 0 ? cantidadNumerica : 1);
    setCantidad('1');
  }

  return (
    <Card sinPadding className="flex h-full flex-col">
      <div className="space-y-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar producto por código o nombre…" />
          </div>
          <input
            type="number"
            min={1}
            step="any"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            title="Cantidad a agregar por clic"
            className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-center text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        {!!categorias?.length && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setCategoria(null)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                categoria === null
                  ? 'border-sol-400 bg-sol-50 text-sol-700 dark:border-sol-700 dark:bg-sol-900/30 dark:text-sol-300'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400'
              }`}
            >
              Todas
            </button>
            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  categoria === c
                    ? 'border-sol-400 bg-sol-50 text-sol-700 dark:border-sol-700 dark:bg-sol-900/30 dark:text-sol-300'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 xl:grid-cols-4" style={{ maxHeight: 560 }}>
        {isLoading && <p className="col-span-full text-sm text-slate-500">Cargando catálogo…</p>}
        {!isLoading && data?.datos.length === 0 && <p className="col-span-full text-sm text-slate-400">Sin productos para mostrar.</p>}
        {data?.datos.map((producto) => (
          <button
            key={producto.id}
            type="button"
            onClick={() => agregar(producto)}
            disabled={!producto.precioVenta}
            title={!producto.precioVenta ? 'Sin precio configurado' : undefined}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 p-2 text-center transition-colors hover:border-sol-400 hover:bg-sol-50/50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:hover:bg-sol-900/10"
          >
            <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-md bg-slate-50 dark:bg-slate-800">
              {producto.imagen ? (
                <img src={producto.imagen} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package size={22} className="text-slate-300 dark:text-slate-600" />
              )}
            </div>
            <p className="line-clamp-2 text-xs font-medium leading-tight text-slate-700 dark:text-slate-300">{producto.nombre}</p>
            <p className="text-xs font-semibold text-sol-600 dark:text-sol-400">
              {producto.precioVenta ? formatoRD(producto.precioVenta) : 'Sin precio'}
            </p>
          </button>
        ))}
      </div>
    </Card>
  );
}
