import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';
import { imprimirEtiquetas, descargarZplEtiquetas, descargarEplEtiquetas, type EtiquetaCodigoBarras } from '../lib/etiquetas-codigo-barras';

interface VarianteBusqueda {
  id: string;
  sku: string | null;
  codigoBarras: string | null;
  producto: { id: string; nombre: string; codigo: string };
  valoresAtributo: { atributo: string; valor: string }[];
}

interface LineaSeleccionada extends VarianteBusqueda {
  cantidad: number;
}

function nombreVariante(fila: VarianteBusqueda) {
  const atributos = fila.valoresAtributo.map((va) => `${va.atributo}: ${va.valor}`).join(', ');
  return atributos ? `${fila.producto.nombre} (${atributos})` : fila.producto.nombre;
}

export function EtiquetasCodigoBarras() {
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [seleccion, setSeleccion] = useState<LineaSeleccionada[]>([]);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data, isLoading } = useQuery({
    queryKey: ['variantes-buscar', busquedaDebounced, pagina],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<VarianteBusqueda>>('/productos/variantes/buscar', {
          params: { busqueda: busquedaDebounced || undefined, pagina },
        })
      ).data,
  });

  const filas = data?.datos ?? [];

  function agregar(fila: VarianteBusqueda) {
    setSeleccion((prev) => (prev.some((l) => l.id === fila.id) ? prev : [...prev, { ...fila, cantidad: 1 }]));
  }

  function quitar(varianteId: string) {
    setSeleccion((prev) => prev.filter((l) => l.id !== varianteId));
  }

  function cambiarCantidad(varianteId: string, cantidad: number) {
    setSeleccion((prev) => prev.map((l) => (l.id === varianteId ? { ...l, cantidad: Math.max(1, cantidad) } : l)));
  }

  function armarEtiquetas(): EtiquetaCodigoBarras[] {
    const etiquetas: EtiquetaCodigoBarras[] = [];
    for (const linea of seleccion) {
      if (!linea.codigoBarras) continue;
      for (let i = 0; i < linea.cantidad; i++) {
        etiquetas.push({
          codigoBarras: linea.codigoBarras,
          nombreProducto: linea.producto.nombre,
          variante: linea.valoresAtributo.map((va) => `${va.atributo}: ${va.valor}`).join(', ') || undefined,
        });
      }
    }
    return etiquetas;
  }

  const hayEtiquetasImprimibles = seleccion.some((l) => l.codigoBarras);

  return (
    <RequierePermiso permiso="precios.ver">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Etiquetas de código de barras</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Buscá productos de todo el catálogo, elegí cuántas etiquetas necesitás de cada uno, e imprimí o descargá todo junto.
          </p>
        </div>

        <Card sinPadding titulo="Buscar productos" acciones={<SearchInput value={busqueda} onChange={(v) => { setBusqueda(v); setPagina(1); }} placeholder="Buscar por código, SKU, código de barras o nombre…" />}>
          {!isLoading && filas.length === 0 ? (
            <div className="p-5">
              <EstadoVacio titulo="Sin resultados" descripcion="Probá con otro término de búsqueda." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Producto</th>
                    <th className="px-5 py-3 font-medium">Código de barras</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filas.map((f) => {
                    const yaElegido = seleccion.some((l) => l.id === f.id);
                    return (
                      <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{nombreVariante(f)}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{f.codigoBarras ?? '—'}</td>
                        <td className="px-5 py-3 text-right">
                          <Button variante="secundario" disabled={yaElegido} onClick={() => agregar(f)}>
                            {yaElegido ? 'Agregado' : 'Agregar'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data && (
            <div className="px-5 py-3">
              <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>

        <Card titulo="Etiquetas a generar" descripcion={`${seleccion.length} producto(s) elegido(s)`}>
          {seleccion.length === 0 ? (
            <EstadoVacio titulo="Todavía no elegiste ningún producto" descripcion="Agregá productos desde la búsqueda de arriba." />
          ) : (
            <div className="space-y-2">
              {seleccion.map((linea) => (
                <div key={linea.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                  <span className="flex-1 text-slate-700 dark:text-slate-300">{nombreVariante(linea)}</span>
                  {linea.codigoBarras ? (
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{linea.codigoBarras}</span>
                  ) : (
                    <span className="text-xs text-amber-700 dark:text-amber-400">Sin código — generalo primero desde el producto</span>
                  )}
                  <input
                    type="number"
                    min={1}
                    value={linea.cantidad}
                    disabled={!linea.codigoBarras}
                    onChange={(e) => cambiarCantidad(linea.id, Number(e.target.value) || 1)}
                    className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => quitar(linea.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    aria-label="Quitar"
                  >
                    ×
                  </button>
                </div>
              ))}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button disabled={!hayEtiquetasImprimibles} onClick={() => imprimirEtiquetas(armarEtiquetas())}>
                  Imprimir etiquetas
                </Button>
                <Button
                  variante="secundario"
                  disabled={!hayEtiquetasImprimibles}
                  onClick={() => descargarZplEtiquetas(armarEtiquetas())}
                  title="Descarga un archivo .zpl para impresoras de etiquetas Zebra"
                >
                  ZPL
                </Button>
                <Button
                  variante="secundario"
                  disabled={!hayEtiquetasImprimibles}
                  onClick={() => descargarEplEtiquetas(armarEtiquetas())}
                  title="Descarga un archivo .epl para impresoras de etiquetas Eltron/Zebra"
                >
                  EPL
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </RequierePermiso>
  );
}
