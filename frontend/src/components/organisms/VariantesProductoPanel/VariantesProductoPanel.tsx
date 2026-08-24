import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { useVariantesProducto, etiquetaVariante, type VarianteProducto } from '../../../hooks/useVariantesProducto';
import { imprimirEtiquetas, descargarZplEtiquetas, descargarEplEtiquetas } from '../../../lib/etiquetas-codigo-barras';

interface ValorAtributo {
  id: string;
  valor: string;
}

interface Atributo {
  id: string;
  nombre: string;
  valores: ValorAtributo[];
}

function mensajeError(err: unknown, fallback: string): string {
  const mensaje =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
      : undefined;
  return mensaje ?? fallback;
}

/**
 * Arma atributos → variantes de un producto (Fase 3c de adopción de
 * Cuadre): elegir qué valores de cada atributo aplican y generar el
 * producto cartesiano — una VarianteProducto por combinación. Solo
 * disponible con el producto ya creado (ProductosService.actualizar()
 * es el único que dispara la regeneración) y para tipo PRODUCTO (un
 * COMBO nunca tiene stock propio, no tiene sentido armarle variantes).
 */
export function VariantesProductoPanel({ productoId, nombreProducto }: { productoId: string; nombreProducto: string }) {
  const queryClient = useQueryClient();
  const [seleccion, setSeleccion] = useState<Record<string, Set<string>>>({});
  const [inicializado, setInicializado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: atributos } = useQuery({
    queryKey: ['atributos'],
    queryFn: async () => (await apiClient.get<Atributo[]>('/atributos')).data,
  });
  const { data: variantes } = useVariantesProducto(productoId);

  // Precarga la selección actual a partir de las variantes ya existentes —
  // solo una vez, para no pisar lo que el usuario esté por cambiar.
  useEffect(() => {
    if (inicializado || !variantes) return;
    const inicial: Record<string, Set<string>> = {};
    for (const v of variantes) {
      for (const va of v.valoresAtributo) {
        const atributoId = va.valorAtributo.atributoId;
        if (!inicial[atributoId]) inicial[atributoId] = new Set();
        inicial[atributoId].add(va.valorAtributo.id);
      }
    }
    setSeleccion(inicial);
    setInicializado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantes]);

  function toggleValor(atributoId: string, valorId: string) {
    setSeleccion((prev) => {
      const actual = new Set(prev[atributoId] ?? []);
      if (actual.has(valorId)) actual.delete(valorId);
      else actual.add(valorId);
      return { ...prev, [atributoId]: actual };
    });
  }

  const generar = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(seleccion)
        .filter(([, valores]) => valores.size > 0)
        .map(([atributoId, valores]) => ({ atributoId, valoresIds: [...valores] }));
      return apiClient.patch(`/productos/${productoId}`, { atributos: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variantes-producto', productoId] });
      setError(null);
    },
    onError: (err: unknown) => setError(mensajeError(err, 'No se pudieron generar las variantes.')),
  });

  const guardarCodigoBarras = useMutation({
    mutationFn: async ({ varianteId, codigoBarras }: { varianteId: string; codigoBarras: string | null }) =>
      apiClient.patch(`/productos/${productoId}/variantes/${varianteId}`, { codigoBarras }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['variantes-producto', productoId] }),
    onError: (err: unknown) => setError(mensajeError(err, 'No se pudo guardar el código de barras.')),
  });

  const combinacionesPrevistas = Object.values(seleccion).filter((v) => v.size > 0);
  const totalPrevisto = combinacionesPrevistas.reduce((acc, v) => acc * v.size, 1);

  function etiquetasParaImprimir() {
    return (variantes ?? [])
      .filter((v): v is VarianteProducto & { codigoBarras: string } => !!v.codigoBarras)
      .map((v) => ({ codigoBarras: v.codigoBarras, nombreProducto, variante: etiquetaVariante(v) || undefined }));
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Variantes (Talla, Color, etc.)</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Elegí qué valores aplican de cada atributo — se genera una variante por cada combinación. Sin ningún valor elegido, el
        producto vuelve a tener una única variante "por defecto".
      </p>

      {atributos?.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Todavía no hay atributos creados — andá a Admin → Catálogo → Atributos para crear "Talla", "Color", etc.
        </p>
      )}

      {atributos?.map((atributo) => (
        <div key={atributo.id}>
          <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">{atributo.nombre}</p>
          <div className="flex flex-wrap gap-1.5">
            {atributo.valores.map((valor) => {
              const elegido = seleccion[atributo.id]?.has(valor.id) ?? false;
              return (
                <button
                  key={valor.id}
                  type="button"
                  onClick={() => toggleValor(atributo.id, valor.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    elegido
                      ? 'border-sol-400 bg-sol-50 text-sol-700 dark:border-sol-700 dark:bg-sol-900/30 dark:text-sol-300'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400'
                  }`}
                >
                  {valor.valor}
                </button>
              );
            })}
            {atributo.valores.length === 0 && <span className="text-xs text-slate-400">Sin valores.</span>}
          </div>
        </div>
      ))}

      {combinacionesPrevistas.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Se generarían {totalPrevisto} variante(s).</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="button" variante="secundario" disabled={generar.isPending} onClick={() => generar.mutate()}>
        {generar.isPending ? 'Generando…' : 'Generar variantes'}
      </Button>

      {variantes && variantes.length > 0 && (
        <div className="space-y-2 border-t border-slate-200 pt-2 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Variantes actuales ({variantes.length})</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variante="secundario"
                disabled={!variantes.some((v) => v.codigoBarras)}
                onClick={() => imprimirEtiquetas(etiquetasParaImprimir())}
              >
                Imprimir etiquetas
              </Button>
              <Button
                type="button"
                variante="secundario"
                disabled={!variantes.some((v) => v.codigoBarras)}
                onClick={() => descargarZplEtiquetas(etiquetasParaImprimir())}
                title="Descarga un archivo .zpl para impresoras de etiquetas Zebra"
              >
                ZPL
              </Button>
              <Button
                type="button"
                variante="secundario"
                disabled={!variantes.some((v) => v.codigoBarras)}
                onClick={() => descargarEplEtiquetas(etiquetasParaImprimir())}
                title="Descarga un archivo .epl para impresoras de etiquetas Eltron/Zebra"
              >
                EPL
              </Button>
            </div>
          </div>
          {variantes.map((v) => (
            <div key={v.id} className="flex items-center gap-2 text-xs">
              <span className="flex-1 text-slate-700 dark:text-slate-300">{etiquetaVariante(v) || '(sin atributos — por defecto)'}</span>
              <input
                type="text"
                placeholder="Código de barras"
                defaultValue={v.codigoBarras ?? ''}
                key={v.id + (v.codigoBarras ?? '')}
                onBlur={(e) => {
                  const valor = e.target.value.trim();
                  if (valor === (v.codigoBarras ?? '')) return;
                  guardarCodigoBarras.mutate({ varianteId: v.id, codigoBarras: valor || null });
                }}
                className="w-36 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <Badge tono={v.activa ? 'exito' : 'neutro'}>{v.activa ? 'Activa' : 'Inactiva'}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
