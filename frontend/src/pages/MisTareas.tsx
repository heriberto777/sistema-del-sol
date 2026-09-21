import { DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, CalendarCheck, CheckCircle2, Copy, ListTodo, MessageSquare, Search, Send, Settings, Sparkles, Trash2, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { soloFecha } from '../lib/fecha';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { TareaPersonalModal } from '../components/organisms/TareaPersonalModal/TareaPersonalModal';
import { CategoriasIncentivoModal } from '../components/organisms/CategoriasIncentivoModal/CategoriasIncentivoModal';
import { Modal } from '../components/molecules/Modal/Modal';
import {
  CategoriaIncentivo,
  COLOR_BORDE_ESTADO_TAREA_PERSONAL,
  ESTADOS_TAREA_PERSONAL,
  ETIQUETA_ESTADO_TAREA_PERSONAL,
  ETIQUETA_PRIORIDAD_TAREA_PERSONAL,
  PRIORIDADES_TAREA_PERSONAL,
  PUNTO_PRIORIDAD_TAREA_PERSONAL,
  ResumenIncentivo,
  TareaPersonal,
} from '../types/tareas-personales';

const CLAVE_VISTA = 'mis-tareas-vista';
type Vista = 'lista' | 'kanban' | 'agenda' | 'estadisticas' | 'incentivos';
const VISTAS: { id: Vista; etiqueta: string }[] = [
  { id: 'lista', etiqueta: 'Lista' },
  { id: 'kanban', etiqueta: 'Tablero' },
  { id: 'agenda', etiqueta: 'Agenda semanal' },
  { id: 'estadisticas', etiqueta: 'Estadísticas' },
  { id: 'incentivos', etiqueta: 'Incentivos' },
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

/**
 * `tarea.fecha` es un día calendario, no un instante — llega como
 * "YYYY-MM-DDT00:00:00.000Z" (medianoche UTC). Construirla con
 * `new Date(iso)` y mostrarla en huso horario local retrocede un día
 * en cualquier zona detrás de UTC (ej. RD, UTC-4): medianoche UTC del
 * 11 cae en 10 a las 20:00 hora local. Se arma la fecha a partir de los
 * componentes del string directamente para que el día nunca cambie.
 */
function formatoFechaBadge(fecha: string) {
  return soloFecha(fecha).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
}

/** Solo visual (el aviso real por email/WhatsApp lo dispara TareasPersonalesCronService en el backend, mismo criterio de "hoy") — una tarea ya HECHA nunca se resalta, sin importar la fecha. */
function estadoVencimiento(fecha: string, estado: string): 'vencida' | 'hoy' | null {
  if (estado === 'HECHA') return null;
  const dia = soloFecha(fecha);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (dia.getTime() === hoy.getTime()) return 'hoy';
  if (dia.getTime() < hoy.getTime()) return 'vencida';
  return null;
}

const CLASE_BADGE_FECHA: Record<'vencida' | 'hoy', string> = {
  vencida: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  hoy: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
};
const ETIQUETA_BADGE_FECHA: Record<'vencida' | 'hoy', string> = { vencida: 'Vencida', hoy: 'Vence hoy' };

function coincideTexto(tarea: TareaPersonal, busqueda: string): boolean {
  const q = busqueda.trim().toLowerCase();
  if (!q) return true;
  return tarea.titulo.toLowerCase().includes(q) || tarea.etiquetas.some((et) => et.toLowerCase().includes(q));
}

function BuscadorTareas({ valor, onChange, placeholder }: { valor: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Buscar por título o etiqueta…'}
        className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </div>
  );
}

function BotonVerMas({ restante, pagina, onClick }: { restante: number; pagina: number; onClick: () => void }) {
  if (restante <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 hover:border-sol-400 hover:text-sol-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-sol-400"
    >
      Ver {Math.min(pagina, restante)} más
    </button>
  );
}

function FilaTarea({
  tarea,
  onAbrir,
  onToggle,
  onEliminar,
  onDuplicar,
  seleccionable = false,
  seleccionada = false,
  onToggleSeleccion,
}: {
  tarea: TareaPersonal;
  onAbrir: () => void;
  onToggle: () => void;
  onEliminar: () => void;
  onDuplicar: () => void;
  /** Solo se muestra el checkbox de selección cuando hay un filtro de categoría activo (ver VistaLista). */
  seleccionable?: boolean;
  seleccionada?: boolean;
  onToggleSeleccion?: () => void;
}) {
  const hecha = tarea.estado === 'HECHA';
  const vencimiento = tarea.fecha ? estadoVencimiento(tarea.fecha, tarea.estado) : null;
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
      {seleccionable && (
        <input
          type="checkbox"
          checked={seleccionada}
          onChange={onToggleSeleccion}
          className="h-4 w-4 shrink-0 rounded border-slate-300 text-sol-600 focus:ring-sol-500 dark:border-slate-600"
          aria-label="Seleccionar tarea"
        />
      )}
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
      <button type="button" onClick={onAbrir} className="min-w-0 flex-1 truncate text-left">
        {/* El `truncate` va en el botón (el flex item de verdad, con `min-w-0 flex-1`) — puesto
            antes en este `<span>` interno (inline, no block) no recortaba nada: `overflow`
            no aplica a cajas `display:inline`, así que el título se desbordaba encima de los
            badges vecinos en pantallas angostas (bug real, reportado en móvil). */}
        <span className={clsx('text-sm', hecha ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>{tarea.titulo}</span>
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
      {tarea.fecha && (
        <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', vencimiento ? CLASE_BADGE_FECHA[vencimiento] : 'text-slate-400')}>
          {vencimiento ? ETIQUETA_BADGE_FECHA[vencimiento] : formatoFechaBadge(tarea.fecha)}
        </span>
      )}
      {tarea.comentarios.length > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-xs text-slate-400">
          <MessageSquare size={12} /> {tarea.comentarios.length}
        </span>
      )}
      <button type="button" onClick={onDuplicar} className="shrink-0 text-slate-300 hover:text-sol-600" aria-label="Duplicar tarea" title="Duplicar — crea una copia en Por hacer, sin fecha">
        <Copy size={14} />
      </button>
      <button type="button" onClick={onEliminar} className="shrink-0 text-slate-300 hover:text-red-600" aria-label="Eliminar tarea">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

const PAGINA_LISTA = 20;

function VistaLista({
  tareas,
  onAbrir,
  onCambiarEstado,
  onEliminar,
  onDuplicar,
  onDuplicarVarias,
}: {
  tareas: TareaPersonal[];
  onAbrir: (t: TareaPersonal) => void;
  onCambiarEstado: (id: string, estado: string) => void;
  onEliminar: (id: string) => void;
  onDuplicar: (t: TareaPersonal) => void;
  onDuplicarVarias: (ts: TareaPersonal[]) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [categoriasFiltro, setCategoriasFiltro] = useState<Set<string>>(new Set());
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [visiblesPendientes, setVisiblesPendientes] = useState(PAGINA_LISTA);
  const [visiblesHechas, setVisiblesHechas] = useState(PAGINA_LISTA);

  const { data: categorias } = useQuery({
    queryKey: ['categorias-incentivo'],
    queryFn: async () => (await apiClient.get<CategoriaIncentivo[]>('/admin/categorias-incentivo')).data,
  });

  useEffect(() => {
    setVisiblesPendientes(PAGINA_LISTA);
    setVisiblesHechas(PAGINA_LISTA);
  }, [busqueda]);

  useEffect(() => setSeleccionadas(new Set()), [categoriasFiltro]);

  // Sin categorías marcadas = todas. Con una o más marcadas, una tarea
  // entra si su categoría es CUALQUIERA de las marcadas — así se puede
  // duplicar de una vez, por ejemplo, "Backups" + "Reporte" juntas.
  const filtradas = useMemo(
    () =>
      tareas.filter(
        (t) => coincideTexto(t, busqueda) && (categoriasFiltro.size === 0 || (!!t.categoriaIncentivoId && categoriasFiltro.has(t.categoriaIncentivoId))),
      ),
    [tareas, busqueda, categoriasFiltro],
  );
  const pendientes = filtradas.filter((t) => t.estado !== 'HECHA').sort(compararPrioridad);
  const hechas = filtradas.filter((t) => t.estado === 'HECHA');
  const pendientesVisibles = pendientes.slice(0, visiblesPendientes);
  const hechasVisibles = hechas.slice(0, visiblesHechas);

  function alternarCategoriaFiltro(id: string) {
    setCategoriasFiltro((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  function alternarSeleccion(id: string) {
    setSeleccionadas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  const todasSeleccionadas = filtradas.length > 0 && filtradas.every((t) => seleccionadas.has(t.id));

  function alternarSeleccionarTodas() {
    setSeleccionadas(todasSeleccionadas ? new Set() : new Set(filtradas.map((t) => t.id)));
  }

  function duplicarSeleccionadas() {
    onDuplicarVarias(filtradas.filter((t) => seleccionadas.has(t.id)));
    setSeleccionadas(new Set());
  }

  return (
    <div className="space-y-3">
      {tareas.length > 0 && (
        <div className="space-y-2">
          <BuscadorTareas valor={busqueda} onChange={setBusqueda} />
          {categorias && categorias.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">Categoría:</span>
              {categorias.map((c) => {
                const activa = categoriasFiltro.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => alternarCategoriaFiltro(c.id)}
                    className={clsx(
                      'rounded-full border px-2.5 py-1 text-xs font-medium',
                      activa
                        ? 'border-sol-400 bg-sol-50 text-sol-700 dark:border-sol-500/40 dark:bg-sol-500/10 dark:text-sol-400'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400',
                    )}
                  >
                    {c.nombre}
                  </button>
                );
              })}
              {categoriasFiltro.size > 0 && (
                <button type="button" onClick={() => setCategoriasFiltro(new Set())} className="text-xs text-slate-400 underline hover:text-slate-600 dark:hover:text-slate-300">
                  Limpiar
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Duplicar en lote — pensado para tareas mensuales fijas de uno o
          más renglones de incentivo: marcás la(s) categoría(s), elegís
          cuáles tareas se repiten este mes y las duplicás todas de una
          vez, en "Por hacer" y sin fecha (igual que el duplicado
          individual). */}
      {categoriasFiltro.size > 0 && filtradas.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/60">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={todasSeleccionadas}
              onChange={alternarSeleccionarTodas}
              className="h-4 w-4 rounded border-slate-300 text-sol-600 focus:ring-sol-500 dark:border-slate-600"
            />
            Seleccionar todas ({filtradas.length})
          </label>
          <Button
            type="button"
            variante="secundario"
            disabled={seleccionadas.size === 0}
            onClick={duplicarSeleccionadas}
            className="ml-auto flex items-center gap-1.5 py-1.5 text-xs"
          >
            <Copy size={13} />
            Duplicar seleccionadas ({seleccionadas.size})
          </Button>
        </div>
      )}

      <Card sinPadding>
        {pendientes.length === 0 && hechas.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">
            {busqueda || categoriasFiltro.size > 0 ? 'Ninguna tarea coincide con el filtro.' : 'Sin tareas todavía — agregá la primera arriba.'}
          </p>
        )}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {pendientesVisibles.map((t) => (
            <FilaTarea
              key={t.id}
              tarea={t}
              onAbrir={() => onAbrir(t)}
              onToggle={() => onCambiarEstado(t.id, 'HECHA')}
              onEliminar={() => onEliminar(t.id)}
              onDuplicar={() => onDuplicar(t)}
              seleccionable={categoriasFiltro.size > 0}
              seleccionada={seleccionadas.has(t.id)}
              onToggleSeleccion={() => alternarSeleccion(t.id)}
            />
          ))}
        </div>
        {pendientes.length > visiblesPendientes && (
          <div className="px-5 py-3">
            <BotonVerMas restante={pendientes.length - visiblesPendientes} pagina={PAGINA_LISTA} onClick={() => setVisiblesPendientes((v) => v + PAGINA_LISTA)} />
          </div>
        )}
        {hechas.length > 0 && (
          <details className="border-t border-slate-100 dark:border-slate-800">
            <summary className="cursor-pointer select-none px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              Completadas ({hechas.length})
            </summary>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {hechasVisibles.map((t) => (
                <FilaTarea
                  key={t.id}
                  tarea={t}
                  onAbrir={() => onAbrir(t)}
                  onToggle={() => onCambiarEstado(t.id, 'PENDIENTE')}
                  onEliminar={() => onEliminar(t.id)}
                  onDuplicar={() => onDuplicar(t)}
                  seleccionable={categoriasFiltro.size > 0}
                  seleccionada={seleccionadas.has(t.id)}
                  onToggleSeleccion={() => alternarSeleccion(t.id)}
                />
              ))}
            </div>
            {hechas.length > visiblesHechas && (
              <div className="px-5 py-3">
                <BotonVerMas restante={hechas.length - visiblesHechas} pagina={PAGINA_LISTA} onClick={() => setVisiblesHechas((v) => v + PAGINA_LISTA)} />
              </div>
            )}
          </details>
        )}
      </Card>
    </div>
  );
}

type Densidad = 'clasica' | 'compacta';

function TarjetaKanban({
  tarea,
  onAbrir,
  onDuplicar,
  densidad = 'clasica',
}: {
  tarea: TareaPersonal;
  onAbrir: () => void;
  /** Omitido en la Agenda semanal (densidad compacta ahí) — no hace falta ese caso de uso. */
  onDuplicar?: () => void;
  densidad?: Densidad;
}) {
  function onDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('text/plain', tarea.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  const vencimiento = tarea.fecha ? estadoVencimiento(tarea.fecha, tarea.estado) : null;

  if (densidad === 'compacta') {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onClick={onAbrir}
        className={clsx(
          // `overflow-hidden` acá es una red de seguridad, no el fix en sí (mismo
          // criterio que Modal.tsx) — el `truncate` del título de abajo ya debería
          // recortarlo solo, pero sin esto un título con un token muy largo (sin
          // espacios) o un redondeo de sub-píxel en pantallas de ~390-420px se
          // desbordaba contra el borde de la tarjeta sin nada que lo contuviera.
          'flex cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg border-y border-r border-l-4 bg-white px-2 py-1.5 shadow-sm hover:shadow dark:border-slate-700 dark:bg-slate-900',
          'border-slate-200',
          COLOR_BORDE_ESTADO_TAREA_PERSONAL[tarea.estado],
        )}
      >
        <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', PUNTO_PRIORIDAD_TAREA_PERSONAL[tarea.prioridad])} />
        <span className="min-w-0 flex-1 truncate text-[12px] text-slate-800 dark:text-slate-100">{tarea.titulo}</span>
        {tarea.fecha && (
          <span className={clsx('shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium', vencimiento ? CLASE_BADGE_FECHA[vencimiento] : 'text-slate-400')}>
            {vencimiento ? ETIQUETA_BADGE_FECHA[vencimiento] : formatoFechaBadge(tarea.fecha)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onAbrir}
      className={clsx(
        'cursor-pointer rounded-lg border-y border-r border-l-4 bg-white p-2 shadow-sm hover:shadow dark:border-slate-700 dark:bg-slate-900',
        'border-slate-200',
        COLOR_BORDE_ESTADO_TAREA_PERSONAL[tarea.estado],
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', PUNTO_PRIORIDAD_TAREA_PERSONAL[tarea.prioridad])} />
        {tarea.fecha && (
          <span className={clsx('rounded-full px-1.5 py-px text-[10px] font-medium', vencimiento ? CLASE_BADGE_FECHA[vencimiento] : 'text-slate-400')}>
            {vencimiento ? ETIQUETA_BADGE_FECHA[vencimiento] : formatoFechaBadge(tarea.fecha)}
          </span>
        )}
        {tarea.comentarios.length > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
            <MessageSquare size={10} /> {tarea.comentarios.length}
          </span>
        )}
        {onDuplicar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicar();
            }}
            className="ml-auto shrink-0 text-slate-300 hover:text-sol-600"
            aria-label="Duplicar tarea"
            title="Duplicar — crea una copia en Por hacer, sin fecha"
          >
            <Copy size={12} />
          </button>
        )}
      </div>
      <p className="line-clamp-2 text-[12.5px] leading-snug text-slate-800 dark:text-slate-100">{tarea.titulo}</p>
      {tarea.etiquetas.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {tarea.etiquetas.map((et) => (
            <span key={et} className="rounded-full bg-slate-100 px-1.5 py-px text-[9.5px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {et}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const CLAVE_DENSIDAD_TABLERO = 'mis-tareas-densidad-tablero';
const PAGINA_KANBAN = 8;

function SegmentadoDensidad({ valor, onChange }: { valor: Densidad; onChange: (v: Densidad) => void }) {
  const OPCIONES: { id: Densidad; etiqueta: string }[] = [
    { id: 'clasica', etiqueta: 'Clásica' },
    { id: 'compacta', etiqueta: 'Compacta' },
  ];
  return (
    <div className="inline-flex gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60">
      {OPCIONES.map((op) => (
        <button
          key={op.id}
          type="button"
          onClick={() => onChange(op.id)}
          className={clsx(
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            valor === op.id ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
          )}
        >
          {op.etiqueta}
        </button>
      ))}
    </div>
  );
}

function VistaKanban({
  tareas,
  onAbrir,
  onCambiarEstado,
  onDuplicar,
}: {
  tareas: TareaPersonal[];
  onAbrir: (t: TareaPersonal) => void;
  onCambiarEstado: (id: string, estado: string) => void;
  onDuplicar: (t: TareaPersonal) => void;
}) {
  const [columnaDestacada, setColumnaDestacada] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [visiblesPorColumna, setVisiblesPorColumna] = useState<Record<string, number>>({});
  const [densidad, setDensidad] = useState<Densidad>(() => (localStorage.getItem(CLAVE_DENSIDAD_TABLERO) === 'compacta' ? 'compacta' : 'clasica'));

  useEffect(() => localStorage.setItem(CLAVE_DENSIDAD_TABLERO, densidad), [densidad]);
  useEffect(() => setVisiblesPorColumna({}), [busqueda]);

  const filtradas = useMemo(() => tareas.filter((t) => coincideTexto(t, busqueda)), [tareas, busqueda]);

  function onDrop(e: DragEvent<HTMLDivElement>, estado: string) {
    e.preventDefault();
    setColumnaDestacada(null);
    const id = e.dataTransfer.getData('text/plain');
    const tarea = tareas.find((t) => t.id === id);
    if (tarea && tarea.estado !== estado) onCambiarEstado(id, estado);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BuscadorTareas valor={busqueda} onChange={setBusqueda} placeholder="Buscar en el tablero…" />
        <SegmentadoDensidad valor={densidad} onChange={setDensidad} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ESTADOS_TAREA_PERSONAL.map((estado) => {
          const items = filtradas.filter((t) => t.estado === estado).sort(compararPrioridad);
          const visibles = visiblesPorColumna[estado] ?? PAGINA_KANBAN;
          const slice = items.slice(0, visibles);
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
              {slice.map((t) => (
                <TarjetaKanban key={t.id} tarea={t} onAbrir={() => onAbrir(t)} onDuplicar={() => onDuplicar(t)} densidad={densidad} />
              ))}
              {items.length === 0 && (
                <p className="px-1 text-xs text-slate-300 dark:text-slate-600">{busqueda ? 'Nada por acá.' : 'Arrastrá una tarea acá'}</p>
              )}
              <BotonVerMas
                restante={items.length - slice.length}
                pagina={PAGINA_KANBAN}
                onClick={() => setVisiblesPorColumna((v) => ({ ...v, [estado]: visibles + PAGINA_KANBAN }))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PAGINA_AGENDA = 6;
const CLAVE_SIN_FECHA = 'sin-fecha';

function ColumnaAgenda({
  claveColumna,
  etiqueta,
  destacada,
  items,
  visibles,
  onVerMas,
  onAbrir,
}: {
  claveColumna: string;
  etiqueta: string;
  destacada: boolean;
  items: TareaPersonal[];
  visibles: number;
  onVerMas: (clave: string) => void;
  onAbrir: (t: TareaPersonal) => void;
}) {
  const slice = items.slice(0, visibles);
  return (
    <div className={clsx('flex flex-col rounded-xl border', destacada ? 'border-sol-300 bg-sol-50/60 dark:bg-sol-500/5' : 'border-slate-200 dark:border-slate-800')}>
      <p className={clsx('shrink-0 px-2 pb-1.5 pt-2.5 text-center text-xs font-semibold', destacada ? 'text-sol-700 dark:text-sol-400' : 'text-slate-400')}>{etiqueta}</p>
      <div className="space-y-1 px-2 pb-2">
        {slice.map((t) => (
          <TarjetaKanban key={t.id} tarea={t} onAbrir={() => onAbrir(t)} densidad="compacta" />
        ))}
        {items.length - slice.length > 0 && (
          <button
            type="button"
            onClick={() => onVerMas(claveColumna)}
            className="w-full rounded-md py-1 text-center text-[10px] font-semibold text-sol-600 hover:bg-sol-50 dark:text-sol-400 dark:hover:bg-sol-500/10"
          >
            +{Math.min(PAGINA_AGENDA, items.length - slice.length)} más
          </button>
        )}
      </div>
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
  const [visiblesPorDia, setVisiblesPorDia] = useState<Record<string, number>>({});

  function onVerMas(clave: string) {
    setVisiblesPorDia((v) => ({ ...v, [clave]: (v[clave] ?? PAGINA_AGENDA) + PAGINA_AGENDA }));
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-8 gap-2">
        {dias.map((d) => {
          const clave = d.toISOString();
          const hoy = esMismoDia(d, new Date());
          const items = tareas.filter((t) => t.fecha && esMismoDia(soloFecha(t.fecha), d)).sort(compararPrioridad);
          return (
            <ColumnaAgenda
              key={clave}
              claveColumna={clave}
              etiqueta={formatoDiaCorto(d)}
              destacada={hoy}
              items={items}
              visibles={visiblesPorDia[clave] ?? PAGINA_AGENDA}
              onVerMas={onVerMas}
              onAbrir={onAbrir}
            />
          );
        })}
        <ColumnaAgenda
          claveColumna={CLAVE_SIN_FECHA}
          etiqueta="Sin fecha"
          destacada={false}
          items={sinFecha}
          visibles={visiblesPorDia[CLAVE_SIN_FECHA] ?? PAGINA_AGENDA}
          onVerMas={onVerMas}
          onAbrir={onAbrir}
        />
      </div>
    </div>
  );
}

const TONOS_TARJETA: Record<'neutral' | 'success' | 'danger', string> = {
  neutral: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  danger: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400',
};

function TarjetaEstadistica({
  etiqueta,
  valor,
  detalle,
  icon: Icon,
  tono = 'neutral',
}: {
  etiqueta: string;
  valor: string | number;
  detalle?: string;
  icon: LucideIcon;
  tono?: 'neutral' | 'success' | 'danger';
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TONOS_TARJETA[tono])}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-tight text-slate-900 dark:text-slate-100">{valor}</p>
        <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{etiqueta}</p>
        {detalle && <p className="text-[11px] text-slate-400">{detalle}</p>}
      </div>
    </div>
  );
}

function FilaBarra({ etiqueta, cantidad, total, color }: { etiqueta: string; cantidad: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((cantidad / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-xs text-slate-500 dark:text-slate-400">{etiqueta}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-medium text-slate-500 dark:text-slate-400">{cantidad}</span>
    </div>
  );
}

const COLOR_ESTADO_TAREA_PERSONAL: Record<string, string> = {
  PENDIENTE: 'bg-slate-400',
  EN_CURSO: 'bg-blue-500',
  EN_ESPERA: 'bg-amber-500',
  HECHA: 'bg-emerald-500',
};

function VistaEstadisticas({ tareas }: { tareas: TareaPersonal[] }) {
  const total = tareas.length;
  const completadas = tareas.filter((t) => t.estado === 'HECHA').length;
  const activas = total - completadas;
  const pctCompletado = total > 0 ? Math.round((completadas / total) * 100) : 0;

  const inicioSemana = inicioDeSemana(new Date());
  const completadasEstaSemana = tareas.filter((t) => t.completadaEn && new Date(t.completadaEn) >= inicioSemana).length;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vencidas = tareas.filter((t) => t.estado !== 'HECHA' && t.fecha && soloFecha(t.fecha) < hoy).length;

  const porEstado = ESTADOS_TAREA_PERSONAL.map((estado) => ({ estado, cantidad: tareas.filter((t) => t.estado === estado).length }));
  const porPrioridad = [...PRIORIDADES_TAREA_PERSONAL]
    .sort((a, b) => ORDEN_PRIORIDAD[a] - ORDEN_PRIORIDAD[b])
    .map((prioridad) => ({ prioridad, cantidad: tareas.filter((t) => t.prioridad === prioridad).length }));

  const conteoEtiquetas = new Map<string, number>();
  tareas.forEach((t) => t.etiquetas.forEach((et) => conteoEtiquetas.set(et, (conteoEtiquetas.get(et) ?? 0) + 1)));
  const topEtiquetas = [...conteoEtiquetas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxEtiqueta = topEtiquetas[0]?.[1] ?? 0;

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Agregá tareas para ver tus estadísticas acá.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TarjetaEstadistica etiqueta="Tareas activas" valor={activas} icon={ListTodo} />
        <TarjetaEstadistica etiqueta="Completadas" valor={`${pctCompletado}%`} detalle={`${completadas} de ${total}`} icon={CheckCircle2} tono="success" />
        <TarjetaEstadistica etiqueta="Completadas esta semana" valor={completadasEstaSemana} icon={CalendarCheck} />
        <TarjetaEstadistica etiqueta="Vencidas" valor={vencidas} icon={AlertTriangle} tono={vencidas > 0 ? 'danger' : 'neutral'} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card titulo="Por estado">
          <div className="space-y-2.5">
            {porEstado.map(({ estado, cantidad }) => (
              <FilaBarra key={estado} etiqueta={ETIQUETA_ESTADO_TAREA_PERSONAL[estado]} cantidad={cantidad} total={total} color={COLOR_ESTADO_TAREA_PERSONAL[estado]} />
            ))}
          </div>
        </Card>
        <Card titulo="Por prioridad">
          <div className="space-y-2.5">
            {porPrioridad.map(({ prioridad, cantidad }) => (
              <FilaBarra key={prioridad} etiqueta={ETIQUETA_PRIORIDAD_TAREA_PERSONAL[prioridad]} cantidad={cantidad} total={total} color={PUNTO_PRIORIDAD_TAREA_PERSONAL[prioridad]} />
            ))}
          </div>
        </Card>
      </div>

      <Card titulo="Etiquetas más usadas">
        {topEtiquetas.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no usaste etiquetas.</p>
        ) : (
          <div className="space-y-2.5">
            {topEtiquetas.map(([etiqueta, cantidad]) => (
              <FilaBarra key={etiqueta} etiqueta={etiqueta} cantidad={cantidad} total={maxEtiqueta} color="bg-sol-500" />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function formatoMonto(n: number): string {
  return n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Réplica exacta del formato que arma CategoriasIncentivoService.construirMensaje — solo para la vista previa; el mensaje que de verdad se envía lo recalcula el backend al confirmar. */
function construirMensajeIncentivo(resumen: ResumenIncentivo, comentario?: string): string {
  const lineas = resumen.renglones
    .map((r) => `🔹 *${r.nombre}:* ${r.porcentaje.toFixed(2)}% ($${formatoMonto(r.montoGanado)} de $${formatoMonto(r.peso)})`)
    .join('\n');
  const pendientes =
    resumen.tareasPendientes.length > 0
      ? resumen.tareasPendientes.map((t) => `• ${t.titulo}${t.categoriaNombre ? ` (${t.categoriaNombre})` : ''}`).join('\n')
      : 'Ninguna — todas las tareas del período están completadas. 🎉';

  const partes = [
    '📊 *REPORTE DE CUMPLIMIENTO DE INCENTIVO IT*',
    `🗓 *Período:* ${resumen.periodo}`,
    '',
    '*Resumen de Renglones:*',
    lineas,
    '',
    '*Tareas pendientes del período:*',
    pendientes,
    '',
    '-----------------------------------',
    `🎯 *Cumplimiento General:* ${resumen.porcentajeGeneral.toFixed(2)}%`,
    `💰 *Total Incentivo Ganado:* $${formatoMonto(resumen.montoGanadoTotal)} / $${formatoMonto(resumen.pesoTotal)}`,
    '-----------------------------------',
  ];
  if (comentario?.trim()) {
    partes.push('', `💬 *Comentario:* ${comentario.trim()}`);
  }
  partes.push('_Enviado automáticamente desde el Sistema de Gestión IT_');
  return partes.join('\n');
}

function VistaIncentivos() {
  const [mes, setMes] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  });
  const [envioAbierto, setEnvioAbierto] = useState(false);
  const [canal, setCanal] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [destino, setDestino] = useState('');
  const [comentario, setComentario] = useState('');
  const [analisisIa, setAnalisisIa] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const { data: resumen, isLoading } = useQuery({
    queryKey: ['categorias-incentivo-resumen', mes],
    queryFn: async () => (await apiClient.get<ResumenIncentivo>('/admin/categorias-incentivo/resumen', { params: { mes } })).data,
  });

  // Solo se pide cuando el panel de envío está abierto — evita una query
  // de más en cada carga de la vista Incentivos.
  const { data: destinatarios } = useQuery({
    queryKey: ['categorias-incentivo-destinatarios'],
    queryFn: async () => (await apiClient.get<{ id: string; nombre: string; email: string }[]>('/admin/categorias-incentivo/destinatarios')).data,
    enabled: envioAbierto,
  });

  const enviar = useMutation({
    mutationFn: async () =>
      apiClient.post('/admin/categorias-incentivo/resumen/enviar', {
        mes,
        canal,
        destino: destino.trim(),
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
        // Solo tiene efecto con canal EMAIL (ver CategoriasIncentivoService.enviarResumen) —
        // igual se manda siempre que haya texto, más simple que condicionarlo acá también.
        ...(canal === 'EMAIL' && analisisIa.trim() ? { analisisIa: analisisIa.trim() } : {}),
      }),
    onSuccess: () => {
      setError(null);
      setComentario('');
      setAnalisisIa('');
      setExito(canal === 'EMAIL' ? 'Reporte enviado por email.' : 'Reporte enviado por WhatsApp.');
    },
    onError: (err) => {
      setExito(null);
      setError(mensajeErrorApi(err, 'No se pudo enviar el reporte.'));
    },
  });

  const analizarConIa = useMutation({
    mutationFn: async () => (await apiClient.post<{ analisis: string }>('/admin/categorias-incentivo/resumen/analizar-ia', { mes })).data,
    onSuccess: (data) => {
      setError(null);
      setAnalisisIa(data.analisis);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo generar el análisis de IA.')),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Período</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <Button
          type="button"
          onClick={() => {
            setEnvioAbierto((v) => !v);
            setExito(null);
          }}
          className="flex items-center gap-1.5"
        >
          <Send size={15} />
          Enviar reporte
        </Button>
      </div>

      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}

      {resumen && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-900 px-6 py-4 text-white dark:bg-slate-950">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cumplimiento general — {resumen.periodo}</p>
              <p className="text-2xl font-bold">{resumen.porcentajeGeneral.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total incentivo ganado</p>
              <p className="text-2xl font-bold">
                ${formatoMonto(resumen.montoGanadoTotal)} <span className="text-sm font-normal text-slate-400">/ ${formatoMonto(resumen.pesoTotal)}</span>
              </p>
            </div>
          </div>

          {resumen.renglones.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Sin categorías de incentivo activas — creá alguna desde "Categorías de incentivo".</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {resumen.renglones.map((r) => (
                <Card key={r.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{r.nombre}</p>
                  <p
                    className={clsx(
                      'text-xl font-bold',
                      r.porcentaje >= 98 ? 'text-emerald-600 dark:text-emerald-400' : r.porcentaje >= 90 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {r.porcentaje.toFixed(2)}%
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ${formatoMonto(r.montoGanado)} de ${formatoMonto(r.peso)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {r.tareasCompletadas} de {r.tareasTotales} tarea(s)
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={clsx('h-full rounded-full', r.porcentaje >= 98 ? 'bg-emerald-500' : r.porcentaje >= 90 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ width: `${Math.min(100, r.porcentaje)}%` }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {envioAbierto && resumen && (
        <Modal titulo="Enviar reporte de cumplimiento" onClose={() => setEnvioAbierto(false)}>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCanal('WHATSAPP')}
                className={clsx(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold',
                  canal === 'WHATSAPP' ? 'border-sol-400 bg-sol-50 text-sol-700 dark:bg-sol-500/10 dark:text-sol-400' : 'border-slate-200 text-slate-500 dark:border-slate-700',
                )}
              >
                📱 WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setCanal('EMAIL')}
                className={clsx(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold',
                  canal === 'EMAIL' ? 'border-sol-400 bg-sol-50 text-sol-700 dark:bg-sol-500/10 dark:text-sol-400' : 'border-slate-200 text-slate-500 dark:border-slate-700',
                )}
              >
                ✉️ Email
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{canal === 'EMAIL' ? 'Enviar al email' : 'Enviar al número (con código de país)'}</label>
              {canal === 'EMAIL' && destinatarios && destinatarios.length > 0 && (
                <Select
                  value=""
                  onChange={(e) => e.target.value && setDestino(e.target.value)}
                  className="mb-1"
                >
                  <option value="">Elegir de tu equipo…</option>
                  {destinatarios.map((d) => (
                    <option key={d.id} value={d.email}>
                      {d.nombre} · {d.email}
                    </option>
                  ))}
                </Select>
              )}
              <input
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder={canal === 'EMAIL' ? 'o escribí cualquier email — gerencia@ejemplo.com' : '+1 809 555 0123'}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Comentario (opcional)</label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Una nota para quien recibe el reporte — ej. felicitación, contexto de algo pendiente…"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {!comentario.trim() && <p className="text-xs text-amber-600 dark:text-amber-400">Se enviará sin ningún comentario adicional.</p>}
            </div>
            {canal === 'EMAIL' && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Análisis de IA (opcional — solo se manda por email)</label>
                  <Button type="button" variante="secundario" onClick={() => analizarConIa.mutate()} disabled={analizarConIa.isPending} className="flex shrink-0 items-center gap-1.5 text-xs">
                    <Sparkles size={13} />
                    {analizarConIa.isPending ? 'Analizando…' : analisisIa.trim() ? 'Analizar de nuevo' : 'Analizar con IA'}
                  </Button>
                </div>
                <textarea
                  value={analisisIa}
                  onChange={(e) => setAnalisisIa(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder="Generá un análisis con IA o escribilo a mano — se agrega como un bloque aparte en el correo."
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Vista previa</label>
              <pre className="whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-[11.5px] leading-relaxed text-emerald-100">{construirMensajeIncentivo(resumen, comentario)}</pre>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {exito && <p className="text-sm text-emerald-600 dark:text-emerald-400">{exito}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variante="secundario" onClick={() => setEnvioAbierto(false)}>
                Cerrar
              </Button>
              <Button type="button" onClick={() => enviar.mutate()} disabled={!destino.trim() || enviar.isPending}>
                {enviar.isPending ? 'Enviando…' : 'Enviar ahora'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function MisTareas() {
  const queryClient = useQueryClient();
  const [vista, setVista] = useState<Vista>(() => {
    const guardada = localStorage.getItem(CLAVE_VISTA);
    return guardada === 'kanban' || guardada === 'agenda' || guardada === 'estadisticas' || guardada === 'incentivos' ? (guardada as Vista) : 'lista';
  });
  const [tituloNuevo, setTituloNuevo] = useState('');
  const [tareaAbiertaId, setTareaAbiertaId] = useState<string | null>(null);
  const [categoriasAbierto, setCategoriasAbierto] = useState(false);
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

  // Duplicar = crear de nuevo con los mismos datos, en "Por hacer" y sin
  // fecha (omitir estado/fecha alcanza — el backend ya los pone por
  // default) — pensado para las tareas de incentivo que se repiten mes a
  // mes (CIGUAS APPS, Backups, ITT, ...). Acepta un array para que
  // "Duplicar seleccionadas" reuse la misma mutación que el duplicado
  // individual.
  const duplicar = useMutation({
    mutationFn: async (tareasADuplicar: TareaPersonal[]) =>
      Promise.all(
        tareasADuplicar.map((t) =>
          apiClient.post('/admin/mis-tareas', {
            titulo: t.titulo,
            descripcion: t.descripcion ?? undefined,
            categoriaIncentivoId: t.categoriaIncentivoId ?? undefined,
            prioridad: t.prioridad,
            etiquetas: t.etiquetas,
          }),
        ),
      ),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo duplicar la(s) tarea(s).')),
  });

  function onCrear(e: FormEvent) {
    e.preventDefault();
    if (tituloNuevo.trim()) crear.mutate(tituloNuevo.trim());
  }

  const lista = tareas ?? [];
  const tareaActual = tareaAbiertaId ? lista.find((t) => t.id === tareaAbiertaId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Mis tareas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Tu lista personal — nadie más la ve.</p>
        </div>
        <button
          type="button"
          onClick={() => setCategoriasAbierto(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Settings size={13} />
          Categorías de incentivo
        </button>
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
        <VistaLista
          tareas={lista}
          onAbrir={(t) => setTareaAbiertaId(t.id)}
          onCambiarEstado={(id, estado) => cambiarEstado.mutate({ id, estado })}
          onEliminar={(id) => eliminar.mutate(id)}
          onDuplicar={(t) => duplicar.mutate([t])}
          onDuplicarVarias={(ts) => duplicar.mutate(ts)}
        />
      )}
      {!isLoading && vista === 'kanban' && (
        <VistaKanban
          tareas={lista}
          onAbrir={(t) => setTareaAbiertaId(t.id)}
          onCambiarEstado={(id, estado) => cambiarEstado.mutate({ id, estado })}
          onDuplicar={(t) => duplicar.mutate([t])}
        />
      )}
      {!isLoading && vista === 'agenda' && <VistaAgenda tareas={lista} onAbrir={(t) => setTareaAbiertaId(t.id)} />}
      {!isLoading && vista === 'estadisticas' && <VistaEstadisticas tareas={lista} />}
      {!isLoading && vista === 'incentivos' && <VistaIncentivos />}

      {tareaActual && <TareaPersonalModal tarea={tareaActual} onClose={() => setTareaAbiertaId(null)} />}
      {categoriasAbierto && <CategoriasIncentivoModal onClose={() => setCategoriasAbierto(false)} />}
    </div>
  );
}
