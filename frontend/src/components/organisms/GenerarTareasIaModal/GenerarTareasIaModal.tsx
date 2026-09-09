import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Milestone, Sparkles, Trash2 } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { Modal } from '../../molecules/Modal/Modal';
import { PRIORIDADES_TAREA, ETIQUETA_PRIORIDAD_TAREA } from '../../../types/proyectos';

interface TareaSugerida {
  titulo: string;
  prioridad: string;
}

interface HitoSugerido {
  nombre: string;
  tareas: TareaSugerida[];
}

interface PlanSugeridoDto {
  hitos: HitoSugerido[];
  tareasSinHito: TareaSugerida[];
}

interface TareaEditable extends TareaSugerida {
  seleccionada: boolean;
}

interface HitoEditable {
  nombre: string;
  seleccionado: boolean;
  tareas: TareaEditable[];
}

export interface PlanIaParaCrear {
  hitos: { nombre: string; tareas: TareaSugerida[] }[];
  sueltas: TareaSugerida[];
}

interface GenerarTareasIaModalProps {
  nombreProyecto: string;
  descripcionInicial?: string;
  onClose: () => void;
  onCrear: (plan: PlanIaParaCrear) => void;
  creando?: boolean;
}

/** Fila de una tarea sugerida — reusada dentro de un hito y en "Sin hito". */
function FilaTarea({
  tarea,
  disabled,
  onCambiar,
  onQuitar,
}: {
  tarea: TareaEditable;
  disabled?: boolean;
  onCambiar: (cambios: Partial<TareaEditable>) => void;
  onQuitar: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1">
      <input
        type="checkbox"
        checked={tarea.seleccionada}
        disabled={disabled}
        onChange={(e) => onCambiar({ seleccionada: e.target.checked })}
        className="h-4 w-4 rounded border-slate-300 text-sol-600 focus:ring-sol-500 disabled:opacity-40"
      />
      <input
        type="text"
        value={tarea.titulo}
        disabled={disabled}
        onChange={(e) => onCambiar({ titulo: e.target.value })}
        className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-slate-900 outline-none hover:border-slate-200 focus:border-sol-500 focus:bg-white disabled:opacity-40 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:bg-slate-900"
      />
      <Select value={tarea.prioridad} disabled={disabled} onChange={(e) => onCambiar({ prioridad: e.target.value })} className="w-auto">
        {PRIORIDADES_TAREA.map((p) => (
          <option key={p} value={p}>
            {ETIQUETA_PRIORIDAD_TAREA[p]}
          </option>
        ))}
      </Select>
      <button type="button" onClick={onQuitar} className="text-slate-400 hover:text-red-600" aria-label="Quitar">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/**
 * Reusa la IA que el tenant ya configuró para el Bot de WhatsApp
 * (Configuraciones → Integraciones) — nunca crea nada sola: el usuario
 * revisa/edita/destilda el plan (hitos + tareas agrupadas) antes de
 * confirmar, mismo principio que el analizador de imagen de productos.
 * La IA no inventa fecha objetivo ni monto de los hitos — eso lo completa
 * el usuario después, a mano, igual que si lo hubiera creado a mano.
 */
export function GenerarTareasIaModal({ nombreProyecto, descripcionInicial, onClose, onCrear, creando = false }: GenerarTareasIaModalProps) {
  const [descripcion, setDescripcion] = useState(descripcionInicial ?? '');
  const [hitos, setHitos] = useState<HitoEditable[] | null>(null);
  const [sueltas, setSueltas] = useState<TareaEditable[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generar = useMutation({
    mutationFn: async () => (await apiClient.post<PlanSugeridoDto>('/admin/proyectos/generar-tareas-ia', { nombreProyecto, descripcion })).data,
    onSuccess: (data) => {
      setError(null);
      setHitos(data.hitos.map((h) => ({ nombre: h.nombre, seleccionado: true, tareas: h.tareas.map((t) => ({ ...t, seleccionada: true })) })));
      setSueltas(data.tareasSinHito.map((t) => ({ ...t, seleccionada: true })));
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudieron generar tareas con IA.')),
  });

  function actualizarHito(indice: number, cambios: Partial<HitoEditable>) {
    setHitos((actual) => actual?.map((h, i) => (i === indice ? { ...h, ...cambios } : h)) ?? null);
  }

  function alternarHito(indice: number, seleccionado: boolean) {
    setHitos(
      (actual) => actual?.map((h, i) => (i === indice ? { ...h, seleccionado, tareas: h.tareas.map((t) => ({ ...t, seleccionada: seleccionado })) } : h)) ?? null,
    );
  }

  function actualizarTareaDeHito(hitoIndice: number, tareaIndice: number, cambios: Partial<TareaEditable>) {
    setHitos(
      (actual) =>
        actual?.map((h, i) =>
          i === hitoIndice ? { ...h, tareas: h.tareas.map((t, j) => (j === tareaIndice ? { ...t, ...cambios } : t)) } : h,
        ) ?? null,
    );
  }

  function quitarTareaDeHito(hitoIndice: number, tareaIndice: number) {
    setHitos((actual) => actual?.map((h, i) => (i === hitoIndice ? { ...h, tareas: h.tareas.filter((_, j) => j !== tareaIndice) } : h)) ?? null);
  }

  function quitarHito(indice: number) {
    setHitos((actual) => actual?.filter((_, i) => i !== indice) ?? null);
  }

  function actualizarSuelta(indice: number, cambios: Partial<TareaEditable>) {
    setSueltas((actual) => actual?.map((t, i) => (i === indice ? { ...t, ...cambios } : t)) ?? null);
  }

  function quitarSuelta(indice: number) {
    setSueltas((actual) => actual?.filter((_, i) => i !== indice) ?? null);
  }

  const hayPlan = hitos !== null;
  const hitosSeleccionados = hitos?.filter((h) => h.seleccionado) ?? [];
  const sueltasSeleccionadas = sueltas?.filter((t) => t.seleccionada) ?? [];
  const totalTareas = hitosSeleccionados.reduce((acc, h) => acc + h.tareas.filter((t) => t.seleccionada).length, 0) + sueltasSeleccionadas.length;
  const totalVacio = hitosSeleccionados.length === 0 && totalTareas === 0;

  function confirmar() {
    onCrear({
      hitos: hitosSeleccionados.map((h) => ({
        nombre: h.nombre,
        tareas: h.tareas.filter((t) => t.seleccionada).map(({ titulo, prioridad }) => ({ titulo, prioridad })),
      })),
      sueltas: sueltasSeleccionadas.map(({ titulo, prioridad }) => ({ titulo, prioridad })),
    });
  }

  return (
    <Modal titulo="Generar tareas con IA" onClose={onClose} ancho="xl">
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción del proyecto</label>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            rows={3}
            placeholder="Ej: Remodelación completa de la sala de ventas y bodega del local de Piantini, incluye electricidad, pintura y mobiliario nuevo…"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <p className="text-xs text-slate-400">
            Usa la IA configurada en Configuraciones → Integraciones (WhatsApp). Los hitos salen sin fecha ni monto — los completás después.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!hayPlan && (
          <div className="flex justify-between gap-2">
            <Button type="button" variante="secundario" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" icon={Sparkles} onClick={() => generar.mutate()} disabled={descripcion.trim().length < 10 || generar.isPending}>
              {generar.isPending ? 'Generando…' : 'Generar con IA'}
            </Button>
          </div>
        )}

        {hayPlan && (
          <div className="space-y-3">
            <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
              {hitos!.map((h, hi) => (
                <div key={hi} className="rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 rounded-t-lg border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
                    <input
                      type="checkbox"
                      checked={h.seleccionado}
                      onChange={(e) => alternarHito(hi, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sol-600 focus:ring-sol-500"
                    />
                    <Milestone size={14} className="shrink-0 text-sol-500" />
                    <input
                      type="text"
                      value={h.nombre}
                      onChange={(e) => actualizarHito(hi, { nombre: e.target.value })}
                      className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-900 outline-none hover:border-slate-200 focus:border-sol-500 focus:bg-white dark:text-slate-100 dark:hover:border-slate-700 dark:focus:bg-slate-900"
                    />
                    <button type="button" onClick={() => quitarHito(hi)} className="text-slate-400 hover:text-red-600" aria-label="Quitar hito">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="space-y-0.5 p-2 pl-6">
                    {h.tareas.map((t, ti) => (
                      <FilaTarea
                        key={ti}
                        tarea={t}
                        disabled={!h.seleccionado}
                        onCambiar={(cambios) => actualizarTareaDeHito(hi, ti, cambios)}
                        onQuitar={() => quitarTareaDeHito(hi, ti)}
                      />
                    ))}
                    {h.tareas.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">Sin tareas — se creará el hito vacío.</p>}
                  </div>
                </div>
              ))}

              {sueltas!.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="rounded-t-lg border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                    Sin hito
                  </div>
                  <div className="space-y-0.5 p-2">
                    {sueltas!.map((t, ti) => (
                      <FilaTarea key={ti} tarea={t} onCambiar={(cambios) => actualizarSuelta(ti, cambios)} onQuitar={() => quitarSuelta(ti)} />
                    ))}
                  </div>
                </div>
              )}

              {hitos!.length === 0 && sueltas!.length === 0 && <p className="text-sm text-slate-400">Quitaste todas las sugerencias.</p>}
            </div>

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variante="secundario"
                onClick={() => {
                  setHitos(null);
                  setSueltas(null);
                }}
              >
                Volver a generar
              </Button>
              <Button type="button" disabled={totalVacio || creando} onClick={confirmar}>
                {creando
                  ? 'Creando…'
                  : hitosSeleccionados.length > 0
                    ? `Crear ${hitosSeleccionados.length} hito(s) y ${totalTareas} tarea(s)`
                    : `Crear ${totalTareas} tarea(s)`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
