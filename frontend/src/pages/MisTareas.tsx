import { DragEvent, FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { TareaPersonalModal } from '../components/organisms/TareaPersonalModal/TareaPersonalModal';
import { ESTADOS_TAREA_PERSONAL, ETIQUETA_ESTADO_TAREA_PERSONAL, PUNTO_PRIORIDAD_TAREA_PERSONAL, TareaPersonal } from '../types/tareas-personales';

const CLAVE_VISTA = 'mis-tareas-vista';
type Vista = 'lista' | 'kanban' | 'agenda';
const VISTAS: { id: Vista; etiqueta: string }[] = [
  { id: 'lista', etiqueta: 'Lista' },
  { id: 'kanban', etiqueta: 'Tablero' },
  { id: 'agenda', etiqueta: 'Agenda semanal' },
];

const ORDEN_PRIORIDAD: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
function compararPrioridad(a: TareaPersonal, b: TareaPersonal) {
  return ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad];
}

function inicioDeSemana(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function esMismoDia(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}
function formatoDiaCorto(d: Date) {
  return d.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric' });
}
function formatoFechaBadge(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
}

function FilaTarea({
  tarea,
  onAbrir,
  onToggle,
  onEliminar,
}: {
  tarea: TareaPersonal;
  onAbrir: () => void;
  onToggle: () => void;
  onEliminar: () => void;
}) {
  const hecha = tarea.estado === 'HECHA';
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <button
        type="button"
        onClick={onToggle}
        aria-label={hecha ? 'Reabrir tarea' : 'Marcar como hecha'}
        className={clsx(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
          hecha ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600',
        )}
      >
        {hecha && '✓'}
      </button>
      <span className={clsx('h-2 w-2 shrink-0 rounded-full', PUNTO_PRIORIDAD_TAREA_PERSONAL[tarea.prioridad])} />
      <button type="button" onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <span className={clsx('truncate text-sm', hecha ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>{tarea.titulo}</span>
      </button>
      {(tarea.estado === 'EN_CURSO' || tarea.estado === 'EN_ESPERA') && (
        <span
          className={clsx(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            tarea.estado === 'EN_ESPERA' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
          )}
        >
          {ETIQUETA_ESTADO_TAREA_PERSONAL[tarea.estado]}
        </span>
      )}
      {tarea.etiquetas.slice(0, 2).map((et) => (
        <span key={et} className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:inline-block">
          {et}
        </span>
      ))}
      {tarea.fecha && <span className="shrink-0 text-xs text-slate-400">{formatoFechaBadge(tarea.fecha)}</span>}
      {tarea.comentarios.length > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-xs text-slate-400">
          <MessageSquare size={12} /> {tarea.comentarios.length}
        </span>
      )}
      <button type="button" onClick={onEliminar} className="shrink-0 text-slate-300 hover:text-red-600" aria-label="Eliminar tarea">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function VistaLista({
  tareas,
  onAbrir,
  onCambiarEstado,
  onEliminar,
}: {
  tareas: TareaPersonal[];
  onAbrir: (t: TareaPersonal) => void;
  onCambiarEstado: (id: string, estado: string) => void;
  onEliminar: (id: string) => void;
}) {
  const pendientes = tareas.filter((t) => t.estado !== 'HECHA').sort(compararPrioridad);
  const hechas = tareas.filter((t) => t.estado === 'HECHA');

  return (
    <Card sinPadding>
      {pendientes.length === 0 && hechas.length === 0 && (
        <p className="p-8 text-center text-sm text-slate-400">Sin tareas todavía — agregá la primera arriba.</p>
      )}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {pendientes.map((t) => (
          <FilaTarea key={t.id} tarea={t} onAbrir={() => onAbrir(t)} onToggle={() => onCambiarEstado(t.id, 'HECHA')} onEliminar={() => onEliminar(t.id)} />
        ))}
      </div>
      {hechas.length > 0 && (
        <details className="border-t border-slate-100 dark:border-slate-800">
          <summary className="cursor-pointer select-none px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            Completadas ({hechas.length})
          </summary>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {hechas.map((t) => (
              <FilaTarea key={t.id} tarea={t} onAbrir={() => onAbrir(t)} onToggle={() => onCambiarEstado(t.id, 'PENDIENTE')} onEliminar={() => onEliminar(t.id)} />
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}

function TarjetaKanban({ tarea, onAbrir }: { tarea: TareaPersonal; onAbrir: () => void }) {
  function onDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('text/plain', tarea.id);
    e.dataTransfer.effectAllowed = 'move';
  }
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onAbrir}
      className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className={clsx('h-2 w-2 shrink-0 rounded-full', PUNTO_PRIORIDAD_TAREA_PERSONAL[tarea.prioridad])} />
        {tarea.fecha && <span className="text-[10px] text-slate-400">{formatoFechaBadge(tarea.fecha)}</span>}
        {tarea.comentarios.length > 0 && (
          <span className="ml-auto flex items-center gap-0.5 text-[10px] text-slate-400">
            <MessageSquare size={10} /> {tarea.comentarios.length}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-800 dark:text-slate-100">{tarea.titulo}</p>
      {tarea.etiquetas.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tarea.etiquetas.map((et) => (
            <span key={et} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {et}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function VistaKanban({
  tareas,
  onAbrir,
  onCambiarEstado,
}: {
  tareas: TareaPersonal[];
  onAbrir: (t: TareaPersonal) => void;
  onCambiarEstado: (id: string, estado: string) => void;
}) {
  const [columnaDestacada, setColumnaDestacada] = useState<string | null>(null);

  function onDrop(e: DragEvent<HTMLDivElement>, estado: string) {
    e.preventDefault();
    setColumnaDestacada(null);
    const id = e.dataTransfer.getData('text/plain');
    const tarea = tareas.find((t) => t.id === id);
    if (tarea && tarea.estado !== estado) onCambiarEstado(id, estado);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ESTADOS_TAREA_PERSONAL.map((estado) => {
        const items = tareas.filter((t) => t.estado === estado).sort(compararPrioridad);
        return (
          <div
            key={estado}
            onDragOver={(e) => {
              e.preventDefault();
              setColumnaDestacada(estado);
            }}
            onDragLeave={() => setColumnaDestacada((c) => (c === estado ? null : c))}
            onDrop={(e) => onDrop(e, estado)}
            className={clsx(
              'flex flex-col gap-2 rounded-xl border border-dashed p-3 transition-colors',
              columnaDestacada === estado ? 'border-sol-400 bg-sol-50/60 dark:bg-sol-500/5' : 'border-slate-200 dark:border-slate-800',
            )}
          >
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {ETIQUETA_ESTADO_TAREA_PERSONAL[estado]} <span className="text-slate-300 dark:text-slate-600">({items.length})</span>
            </p>
            {items.map((t) => (
              <TarjetaKanban key={t.id} tarea={t} onAbrir={() => onAbrir(t)} />
            ))}
            {items.length === 0 && <p className="px-1 text-xs text-slate-300 dark:text-slate-600">Arrastrá una tarea acá</p>}
          </div>
        );
      })}
    </div>
  );
}

function VistaAgenda({ tareas, onAbrir }: { tareas: TareaPersonal[]; onAbrir: (t: TareaPersonal) => void }) {
  const inicio = inicioDeSemana(new Date());
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    return d;
  });
  const sinFecha = tareas.filter((t) => !t.fecha && t.estado !== 'HECHA');

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-8 gap-2">
        {dias.map((d) => {
          const hoy = esMismoDia(d, new Date());
          const items = tareas.filter((t) => t.fecha && esMismoDia(new Date(t.fecha), d)).sort(compararPrioridad);
          return (
            <div key={d.toISOString()} className={clsx('flex flex-col gap-2 rounded-xl border p-2.5', hoy ? 'border-sol-300 bg-sol-50/60 dark:bg-sol-500/5' : 'border-slate-200 dark:border-slate-800')}>
              <p className={clsx('text-center text-xs font-semibold', hoy ? 'text-sol-700 dark:text-sol-400' : 'text-slate-400')}>{formatoDiaCorto(d)}</p>
              {items.map((t) => (
                <TarjetaKanban key={t.id} tarea={t} onAbrir={() => onAbrir(t)} />
              ))}
            </div>
          );
        })}
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
          <p className="text-center text-xs font-semibold text-slate-400">Sin fecha</p>
          {sinFecha.map((t) => (
            <TarjetaKanban key={t.id} tarea={t} onAbrir={() => onAbrir(t)} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function MisTareas() {
  const queryClient = useQueryClient();
  const [vista, setVista] = useState<Vista>(() => {
    const guardada = localStorage.getItem(CLAVE_VISTA);
    return guardada === 'kanban' || guardada === 'agenda' ? (guardada as Vista) : 'lista';
  });
  const [tituloNuevo, setTituloNuevo] = useState('');
  const [tareaAbiertaId, setTareaAbiertaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => localStorage.setItem(CLAVE_VISTA, vista), [vista]);

  const { data: tareas, isLoading } = useQuery({
    queryKey: ['mis-tareas'],
    queryFn: async () => (await apiClient.get<TareaPersonal[]>('/admin/mis-tareas')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['mis-tareas'] });
  }

  const crear = useMutation({
    mutationFn: async (titulo: string) => apiClient.post('/admin/mis-tareas', { titulo }),
    onSuccess: () => {
      setTituloNuevo('');
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la tarea.')),
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => apiClient.patch(`/admin/mis-tareas/${id}`, { estado }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo actualizar la tarea.')),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/mis-tareas/${id}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar la tarea.')),
  });

  function onCrear(e: FormEvent) {
    e.preventDefault();
    if (tituloNuevo.trim()) crear.mutate(tituloNuevo.trim());
  }

  const lista = tareas ?? [];
  const tareaActual = tareaAbiertaId ? lista.find((t) => t.id === tareaAbiertaId) ?? null : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Mis tareas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tu lista personal — nadie más la ve.</p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={onCrear} className="flex gap-2">
        <input
          value={tituloNuevo}
          onChange={(e) => setTituloNuevo(e.target.value)}
          placeholder="Agregar una tarea…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <Button type="submit" disabled={!tituloNuevo.trim() || crear.isPending} className="flex items-center gap-1.5">
          <Plus size={16} />
          Agregar
        </Button>
      </form>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            className={clsx(
              'shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
              vista === v.id ? 'border-sol-500 text-sol-600 dark:text-sol-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400',
            )}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}

      {!isLoading && vista === 'lista' && (
        <VistaLista tareas={lista} onAbrir={(t) => setTareaAbiertaId(t.id)} onCambiarEstado={(id, estado) => cambiarEstado.mutate({ id, estado })} onEliminar={(id) => eliminar.mutate(id)} />
      )}
      {!isLoading && vista === 'kanban' && (
        <VistaKanban tareas={lista} onAbrir={(t) => setTareaAbiertaId(t.id)} onCambiarEstado={(id, estado) => cambiarEstado.mutate({ id, estado })} />
      )}
      {!isLoading && vista === 'agenda' && <VistaAgenda tareas={lista} onAbrir={(t) => setTareaAbiertaId(t.id)} />}

      {tareaActual && <TareaPersonalModal tarea={tareaActual} onClose={() => setTareaAbiertaId(null)} />}
    </div>
  );
}
