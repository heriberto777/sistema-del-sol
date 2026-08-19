import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { useVariantesProducto, etiquetaVariante } from '../../../hooks/useVariantesProducto';

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
export function VariantesProductoPanel({ productoId }: { productoId: string }) {
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

  const combinacionesPrevistas = Object.values(seleccion).filter((v) => v.size > 0);
  const totalPrevisto = combinacionesPrevistas.reduce((acc, v) => acc * v.size, 1);

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
        <div className="space-y-1 border-t border-slate-200 pt-2 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Variantes actuales ({variantes.length})</p>
          {variantes.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300">{etiquetaVariante(v) || '(sin atributos — por defecto)'}</span>
              <Badge tono={v.activa ? 'exito' : 'neutro'}>{v.activa ? 'Activa' : 'Inactiva'}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
