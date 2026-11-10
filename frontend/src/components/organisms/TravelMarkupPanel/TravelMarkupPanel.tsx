import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { ETIQUETA_TIPO_TRAVEL_RESERVA, TIPOS_TRAVEL_RESERVA, TravelReglaMarkup } from '../../../types/travel';

const FORM_REGLA_VACIA = { tipo: '', porcentaje: '', montoFijo: '' };

/** Extraído de TravelReservas.tsx (auditoría UX Fase 5) — reglas de markup, antes sin entrada de menú propia en Catálogos. */
export function TravelMarkupPanel() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [form, setForm] = useState(FORM_REGLA_VACIA);
  const [error, setError] = useState<string | null>(null);

  const { data: reglas, isLoading } = useQuery({
    queryKey: ['travel-markup'],
    queryFn: async () => (await apiClient.get<TravelReglaMarkup[]>('/admin/travel/markup')).data,
  });

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/admin/travel/markup', {
        tipo: form.tipo || undefined,
        ...(form.porcentaje !== '' ? { porcentaje: Number(form.porcentaje) } : {}),
        ...(form.montoFijo !== '' ? { montoFijo: Number(form.montoFijo) } : {}),
      }),
    onSuccess: () => {
      setForm(FORM_REGLA_VACIA);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['travel-markup'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la regla.')),
  });

  const toggleActiva = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => apiClient.patch(`/admin/travel/markup/${id}`, { activa }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['travel-markup'] }),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar la regla.')),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/travel/markup/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['travel-markup'] }),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar la regla.')),
  });

  const lista = reglas ?? [];
  const puedeGestionar = tienePermiso('travel.markup');

  return (
    <div className="space-y-4">
      {puedeGestionar && (
        <Card titulo="Nueva regla de markup" descripcion="Sugiere el precio de venta al reservar — nunca lo aplica solo, siempre editable.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crear.mutate();
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end"
          >
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
              <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="">Global (VUELO + HOTEL)</option>
                {TIPOS_TRAVEL_RESERVA.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_TIPO_TRAVEL_RESERVA[t]}
                  </option>
                ))}
              </Select>
            </div>
            <FormField
              label="Porcentaje (%)"
              type="number"
              step="0.01"
              value={form.porcentaje}
              onChange={(e) => setForm({ ...form, porcentaje: e.target.value, montoFijo: '' })}
              placeholder="ej. 15"
            />
            <FormField
              label="Monto fijo"
              type="number"
              step="0.01"
              value={form.montoFijo}
              onChange={(e) => setForm({ ...form, montoFijo: e.target.value, porcentaje: '' })}
              placeholder="ej. 30"
            />
            <Button type="submit" disabled={crear.isPending || (!form.porcentaje && !form.montoFijo)}>
              {crear.isPending ? 'Creando…' : 'Crear regla'}
            </Button>
          </form>
          <p className="mt-2 text-xs text-slate-400">Exactamente uno de los dos campos — porcentaje o monto fijo, nunca ambos.</p>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </Card>
      )}

      <Card sinPadding>
        {isLoading && <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
        {!isLoading && lista.length === 0 && (
          <EstadoVacio titulo="Sin reglas de markup" descripcion="Sin ninguna regla activa, el precio de venta sugerido es igual al costo (0% de markup)." />
        )}
        {!isLoading && lista.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Markup</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lista.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 text-slate-800 dark:text-slate-100">{r.tipo ? ETIQUETA_TIPO_TRAVEL_RESERVA[r.tipo] : 'Global'}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{r.porcentaje ? `+${r.porcentaje}%` : `+${r.montoFijo} (fijo)`}</td>
                  <td className="px-5 py-3">
                    {puedeGestionar ? (
                      <button
                        type="button"
                        onClick={() => toggleActiva.mutate({ id: r.id, activa: !r.activa })}
                        className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', r.activa ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}
                      >
                        {r.activa ? 'Activa' : 'Inactiva'}
                      </button>
                    ) : (
                      <span>{r.activa ? 'Activa' : 'Inactiva'}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {puedeGestionar && (
                      <button type="button" onClick={() => eliminar.mutate(r.id)} className="text-slate-400 hover:text-red-600" aria-label="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
