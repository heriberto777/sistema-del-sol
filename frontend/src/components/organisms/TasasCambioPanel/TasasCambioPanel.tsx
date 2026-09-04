import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

interface TasaCambio {
  id: string;
  moneda: string;
  tasa: string;
  actualizadaEn: string;
}

/**
 * Catálogo de tasas de cambio (plan de integración Cuadre, ítem C-2) —
 * entrada manual, sin feed automático, mismo criterio que Cuadre.
 * `tasa` = cuántos DOP vale 1 unidad de esa moneda (ej. USD 58.50).
 * Solo afecta cómo se PRESENTA una venta (equivalente en el documento
 * impreso) — nunca los precios/costos del catálogo, que siguen en DOP.
 */
export function TasasCambioPanel() {
  const queryClient = useQueryClient();
  const [moneda, setMoneda] = useState('');
  const [tasa, setTasa] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: tasas } = useQuery({
    queryKey: ['tasas-cambio'],
    queryFn: async () => (await apiClient.get<TasaCambio[]>('/tasas-cambio')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['tasas-cambio'] });
  }

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/tasas-cambio', { moneda: moneda.toUpperCase(), tasa: Number(tasa) }),
    onSuccess: () => {
      invalidar();
      setMoneda('');
      setTasa('');
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar (¿ya existe una tasa para esa moneda? Editala abajo en vez de crear otra).')),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, tasa }: { id: string; tasa: number }) => apiClient.patch(`/tasas-cambio/${id}`, { tasa }),
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/tasas-cambio/${id}`),
    onSuccess: invalidar,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Nueva tasa de cambio">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField
            id="tasa-moneda"
            label="Código de moneda (ISO, ej. USD)"
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            maxLength={3}
            required
          />
          <FormField
            id="tasa-valor"
            label="Cuántos DOP vale 1 unidad"
            type="number"
            min={0}
            step="0.000001"
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
            required
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">Ej: si el dólar está a 58.50, poné 58.50.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Tasas de cambio">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Moneda</th>
              <th className="px-5 py-3 font-medium">1 unidad = RD$</th>
              <th className="px-5 py-3 font-medium">Actualizada</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {tasas?.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3 font-mono text-xs">{t.moneda}</td>
                <td className="px-5 py-3">
                  <input
                    type="number"
                    min={0}
                    step="0.000001"
                    defaultValue={t.tasa}
                    onBlur={(e) => {
                      const nueva = Number(e.target.value);
                      if (nueva > 0 && nueva !== Number(t.tasa)) actualizar.mutate({ id: t.id, tasa: nueva });
                    }}
                    className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td className="px-5 py-3">{new Date(t.actualizadaEn).toLocaleDateString('es-DO')}</td>
                <td className="px-5 py-3 text-right">
                  <Button variante="peligro" disabled={eliminar.isPending} onClick={() => eliminar.mutate(t.id)}>
                    Eliminar
                  </Button>
                </td>
              </tr>
            ))}
            {tasas?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                  Sin tasas de cambio configuradas — las ventas solo admiten DOP.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
