import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Modal } from '../../molecules/Modal/Modal';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { aplanarArbolCategorias, type CategoriaPlana } from '../../../lib/categorias-arbol';
import { CLASE_PUNTO_COLOR_CATEGORIA } from '../../../lib/color-categoria';
import { etiquetaVariante, type VarianteProducto } from '../../../hooks/useVariantesProducto';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { CLASE_AJUSTE_IMAGEN, type AjusteImagen } from '../../../constants/ajuste-imagen';

export interface ProductoCatalogo {
  id: string;
  codigo: string;
  nombre: string;
  imagen: string | null;
  imagenAjuste: AjusteImagen;
  porcentajeItbis: string;
  tipo: 'PRODUCTO' | 'SERVICIO' | 'COMBO';
  precioVenta: string | null;
  /** Plan de integración Cuadre, ítem E-8 — habilita un precio editable por línea en el carrito. */
  precioVariable: boolean;
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
  bodegaId,
}: {
  onAgregar: (producto: ProductoCatalogo, cantidad: number, varianteId?: string) => void;
  /** Bodega del turno abierto — se usa solo para mostrar la existencia por variante en el selector, nunca para bloquear el agregado (ver ARCHITECTURE.md). */
  bodegaId: string;
}) {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState('1');
  const [eligiendoVariante, setEligiendoVariante] = useState<{
    producto: ProductoCatalogo;
    variantes: VarianteProducto[];
    precios: Record<string, string | null>;
  } | null>(null);
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
      queryKey: ['variantes-producto', producto.id, bodegaId],
      queryFn: async () =>
        (await apiClient.get<VarianteProducto[]>(`/productos/${producto.id}/variantes`, { params: { bodegaId } })).data,
    });
    if (variantes.length > 1) {
      // El precio de la grilla es el de una variante "representativa" (ver
      // ARCHITECTURE.md, Fase 3b) — con variantes reales, cada una puede
      // tener (o no) su propio precio configurado (ver FormularioPrecio en
      // Productos.tsx). Se resuelven TODOS antes de mostrar el modal para
      // poder deshabilitar de entrada las variantes sin precio — antes se
      // recién enteraba al hacer clic, y como no había ningún aviso, un
      // clic sobre una variante sin precio simplemente no hacía nada (bug
      // real: "a veces la variante no se agrega").
      const precios = await Promise.all(
        variantes.map((v) =>
          queryClient
            .fetchQuery({
              queryKey: ['precio-vigente', producto.id, v.id],
              queryFn: async () =>
                (await apiClient.get<{ precioVenta: string } | null>(`/precios/${producto.id}`, { params: { varianteId: v.id } })).data,
            })
            .then((p) => [v.id, p?.precioVenta ?? null] as const),
        ),
      );
      setEligiendoVariante({ producto, variantes, precios: Object.fromEntries(precios) });
      return;
    }
    onAgregar(producto, cantidadNumerica, variantes[0]?.id);
    setCantidad('1');
  }

  function agregarConVariante(varianteId: string) {
    if (!eligiendoVariante) return;
    const cantidadNumerica = Number(cantidad) > 0 ? Number(cantidad) : 1;
    const { producto, precios } = eligiendoVariante;
    const precioVenta = precios[varianteId] ?? null;
    if (!precioVenta) return; // el botón ya queda deshabilitado en este caso — ver el render de abajo
    onAgregar({ ...producto, precioVenta }, cantidadNumerica, varianteId);
    setCantidad('1');
    setEligiendoVariante(null);
  }

  return (
    <Card sinPadding className="h-full" contentClassName="flex h-full flex-col">
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
                <span className="inline-flex items-center gap-1.5">
                  {c.color && <span className={`h-2 w-2 rounded-full ${CLASE_PUNTO_COLOR_CATEGORIA[c.color]}`} />}
                  {'— '.repeat(c.profundidad)}
                  {c.nombre}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 xl:grid-cols-4">
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
            <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-md bg-slate-50 dark:bg-slate-800">
              {producto.imagen ? (
                <img src={producto.imagen} alt="" className={`h-full w-full ${CLASE_AJUSTE_IMAGEN[producto.imagenAjuste]}`} />
              ) : (
                <Package size={30} className="text-slate-300 dark:text-slate-600" />
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
            {eligiendoVariante.variantes.map((v) => {
              const precioVenta = eligiendoVariante.precios[v.id];
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => agregarConVariante(v.id)}
                  disabled={!precioVenta}
                  title={!precioVenta ? 'Sin precio configurado' : undefined}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-sol-400 hover:bg-sol-50/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-transparent dark:border-slate-800 dark:hover:bg-sol-900/10"
                >
                  <span className="flex flex-col">
                    <span>{etiquetaVariante(v) || '(sin atributos)'}</span>
                    {v.existencia !== undefined && (
                      <span className={v.existencia > 0 ? 'text-xs text-slate-400 dark:text-slate-500' : 'text-xs text-amber-600 dark:text-amber-500'}>
                        {v.existencia > 0 ? `${v.existencia} disponible${v.existencia === 1 ? '' : 's'}` : 'Sin existencia'}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium text-sol-600 dark:text-sol-400">
                    {precioVenta ? formatoRD(precioVenta) : 'Sin precio'}
                  </span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </Card>
  );
}
