import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Modal } from '../../molecules/Modal/Modal';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { aplanarArbolCategorias, type CategoriaPlana } from '../../../lib/categorias-arbol';
import { etiquetaVariante, type VarianteProducto } from '../../../hooks/useVariantesProducto';
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
 * producto como hacía la versión anterior. Chips de categoría (árbol real
 * de `Categoria`, aplanado en orden jerárquico — ver `/categorias`) y un
 * campo de cantidad rápida permiten armar el carrito sin volver a tocar
 * el mouse. Un producto con más de una variante real (Talla/Color, Fase
 * 3c) pide elegir cuál antes de agregarla — el caso normal (una sola
 * variante "por defecto") se resuelve solo, sin ningún paso extra.
 */
export function CatalogoProductosPos({
  onAgregar,
}: {
  onAgregar: (producto: ProductoCatalogo, cantidad: number, varianteId?: string) => void;
}) {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState('1');
  const [eligiendoVariante, setEligiendoVariante] = useState<{ producto: ProductoCatalogo; variantes: VarianteProducto[] } | null>(
    null,
  );
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => (await apiClient.get<CategoriaPlana[]>('/categorias')).data,
  });
  const categoriasPlanas = aplanarArbolCategorias(categorias ?? []);

  const { data, isLoading } = useQuery({
    queryKey: ['pos-catalogo', busquedaDebounced, categoriaId],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<ProductoCatalogo>>('/productos/catalogo', {
          params: { busqueda: busquedaDebounced || undefined, categoriaId: categoriaId ?? undefined, tamanoPagina: 24 },
        })
      ).data,
  });

  async function agregar(producto: ProductoCatalogo) {
    const cantidadNumerica = Number(cantidad) > 0 ? Number(cantidad) : 1;
    const variantes = await queryClient.fetchQuery({
      queryKey: ['variantes-producto', producto.id],
      queryFn: async () => (await apiClient.get<VarianteProducto[]>(`/productos/${producto.id}/variantes`)).data,
    });
    if (variantes.length > 1) {
      setEligiendoVariante({ producto, variantes });
      return;
    }
    onAgregar(producto, cantidadNumerica, variantes[0]?.id);
    setCantidad('1');
  }

  async function agregarConVariante(varianteId: string) {
    if (!eligiendoVariante) return;
    const cantidadNumerica = Number(cantidad) > 0 ? Number(cantidad) : 1;
    const { producto } = eligiendoVariante;
    // El precio de la grilla es el de una variante "representativa" (ver
    // ARCHITECTURE.md, Fase 3b) — con variantes reales, cada una puede
    // tener su propio precio (ver FormularioPrecio en Productos.tsx), así
    // que hay que resolver el precio de la variante REALMENTE elegida
    // antes de agregarla al carrito, no reusar el de la grilla.
    const precio = await queryClient.fetchQuery({
      queryKey: ['precio-vigente', producto.id, varianteId],
      queryFn: async () =>
        (await apiClient.get<{ precioVenta: string } | null>(`/precios/${producto.id}`, { params: { varianteId } })).data,
    });
    onAgregar({ ...producto, precioVenta: precio?.precioVenta ?? null }, cantidadNumerica, varianteId);
    setCantidad('1');
    setEligiendoVariante(null);
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
        {!!categoriasPlanas.length && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setCategoriaId(null)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                categoriaId === null
                  ? 'border-sol-400 bg-sol-50 text-sol-700 dark:border-sol-700 dark:bg-sol-900/30 dark:text-sol-300'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400'
              }`}
            >
              Todas
            </button>
            {categoriasPlanas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoriaId(c.id)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  categoriaId === c.id
                    ? 'border-sol-400 bg-sol-50 text-sol-700 dark:border-sol-700 dark:bg-sol-900/30 dark:text-sol-300'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400'
                }`}
              >
                {'— '.repeat(c.profundidad)}
                {c.nombre}
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

      {eligiendoVariante && (
        <Modal titulo={`Elegí la variante — ${eligiendoVariante.producto.nombre}`} onClose={() => setEligiendoVariante(null)}>
          <div className="space-y-2">
            {eligiendoVariante.variantes.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => agregarConVariante(v.id)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-sol-400 hover:bg-sol-50/50 dark:border-slate-800 dark:hover:bg-sol-900/10"
              >
                {etiquetaVariante(v) || '(sin atributos)'}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </Card>
  );
}
