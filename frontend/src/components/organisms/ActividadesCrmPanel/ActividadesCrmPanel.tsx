import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Trash2 } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { ActividadCrm, ETIQUETA_TIPO_ACTIVIDAD, TipoActividadCrm } from '../../../types/crm';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

type Referencia = { clienteId: string; leadId?: never; oportunidadId?: never } | { leadId: string; clienteId?: never; oportunidadId?: never } | { oportunidadId: string; clienteId?: never; leadId?: never };

/** Timeline + alta rápida de actividades (llamada/reunión/email/nota/tarea) — se embebe en el detalle de un Lead o una Oportunidad. Exactamente una referencia (ver crm.ts). */
export function ActividadesCrmPanel({ referencia }: { referencia: Referencia }) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<TipoActividadCrm>('LLAMADA');
  const [descripcion, setDescripcion] = useState('');
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [error, setError] = useState<string | null>(null);

  const queryKey = ['crm-actividades', referencia];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<ActividadCrm>>('/crm/actividades', { params: { ...referencia, tamanoPagina: 50 } })).data,
  });

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/crm/actividades', { tipo, descripcion, fechaProgramada: fechaProgramada || undefined, ...referencia }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDescripcion('');
      setFechaProgramada('');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar la actividad.')),
  });

  const marcarCompletada = useMutation({
    mutationFn: async ({ id, completada }: { id: string; completada: boolean }) =>
      apiClient.patch(`/crm/actividades/${id}/completada`, { completada }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/crm/actividades/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!descripcion.trim()) {
      setError('Escribí una descripción.');
      return;
    }
    crear.mutate();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoActividadCrm)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {Object.entries(ETIQUETA_TIPO_ACTIVIDAD).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fechaProgramada}
            onChange={(e) => setFechaProgramada(e.target.value)}
            title="Fecha programada — vacío si es una nota retroactiva"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="¿Qué pasó? — ej. Llamé, pidió ajustar cantidades…"
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar actividad'}
          </Button>
        </div>
      </form>

      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
      {!isLoading && data?.datos.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no hay actividades registradas.</p>}

      <div className="flex flex-col gap-2">
        {data?.datos.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {ETIQUETA_TIPO_ACTIVIDAD[a.tipo]}
                </span>
                <span className="text-xs text-slate-400">
                  {a.usuario.nombre} · {new Date(a.createdAt).toLocaleString('es-DO')}
                  {a.fechaProgramada && ` · programada ${new Date(a.fechaProgramada).toLocaleDateString('es-DO')}`}
                </span>
              </div>
              <p className={a.completada ? 'mt-1 text-slate-400 line-through dark:text-slate-500' : 'mt-1 text-slate-700 dark:text-slate-300'}>
                {a.descripcion}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {a.fechaProgramada && (
                <button
                  type="button"
                  title={a.completada ? 'Marcar pendiente' : 'Marcar completada'}
                  onClick={() => marcarCompletada.mutate({ id: a.id, completada: !a.completada })}
                  className={a.completada ? 'rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}
                >
                  <Check size={15} />
                </button>
              )}
              <button
                type="button"
                title="Eliminar"
                onClick={() => eliminar.mutate(a.id)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
