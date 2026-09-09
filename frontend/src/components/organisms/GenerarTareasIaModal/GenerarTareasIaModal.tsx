import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Trash2 } from 'lucide-react';
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

interface TareaSugeridaEditable extends TareaSugerida {
  seleccionada: boolean;
}

interface GenerarTareasIaModalProps {
  nombreProyecto: string;
  descripcionInicial?: string;
  onClose: () => void;
  onCrear: (tareas: TareaSugerida[]) => void;
  creando?: boolean;
}

/**
 * Reusa la IA que el tenant ya configuró para el Bot de WhatsApp
 * (Configuraciones → Integraciones) — nunca crea tareas sola: el usuario
 * revisa/edita/destilda antes de confirmar, mismo principio que el
 * analizador de imagen de productos.
 */
export function GenerarTareasIaModal({ nombreProyecto, descripcionInicial, onClose, onCrear, creando = false }: GenerarTareasIaModalProps) {
  const [descripcion, setDescripcion] = useState(descripcionInicial ?? '');
  const [sugerencias, setSugerencias] = useState<TareaSugeridaEditable[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generar = useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ tareas: TareaSugerida[] }>('/admin/proyectos/generar-tareas-ia', { nombreProyecto, descripcion })).data,
    onSuccess: (data) => {
      setError(null);
      setSugerencias(data.tareas.map((t) => ({ ...t, seleccionada: true })));
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudieron generar tareas con IA.')),
  });

  function actualizarSugerencia(indice: number, cambios: Partial<TareaSugeridaEditable>) {
    setSugerencias((actual) => actual?.map((s, i) => (i === indice ? { ...s, ...cambios } : s)) ?? null);
  }

  function quitarSugerencia(indice: number) {
    setSugerencias((actual) => actual?.filter((_, i) => i !== indice) ?? null);
  }

  const seleccionadas = sugerencias?.filter((s) => s.seleccionada) ?? [];

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
          <p className="text-xs text-slate-400">Usa la IA configurada en Configuraciones → Integraciones (WhatsApp).</p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!sugerencias && (
          <div className="flex justify-between gap-2">
            <Button type="button" variante="secundario" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" icon={Sparkles} onClick={() => generar.mutate()} disabled={descripcion.trim().length < 10 || generar.isPending}>
              {generar.isPending ? 'Generando…' : 'Generar tareas con IA'}
            </Button>
          </div>
        )}

        {sugerencias && (
          <div className="space-y-3">
            <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {sugerencias.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <input
                    type="checkbox"
                    checked={s.seleccionada}
                    onChange={(e) => actualizarSugerencia(i, { seleccionada: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-sol-600 focus:ring-sol-500"
                  />
                  <input
                    type="text"
                    value={s.titulo}
                    onChange={(e) => actualizarSugerencia(i, { titulo: e.target.value })}
                    className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-slate-900 outline-none hover:border-slate-200 focus:border-sol-500 focus:bg-white dark:text-slate-100 dark:hover:border-slate-700 dark:focus:bg-slate-900"
                  />
                  <Select value={s.prioridad} onChange={(e) => actualizarSugerencia(i, { prioridad: e.target.value })} className="w-auto">
                    {PRIORIDADES_TAREA.map((p) => (
                      <option key={p} value={p}>
                        {ETIQUETA_PRIORIDAD_TAREA[p]}
                      </option>
                    ))}
                  </Select>
                  <button type="button" onClick={() => quitarSugerencia(i)} className="text-slate-400 hover:text-red-600" aria-label="Quitar">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {sugerencias.length === 0 && <p className="text-sm text-slate-400">Quitaste todas las sugerencias.</p>}
            </div>

            <div className="flex justify-between gap-2">
              <Button type="button" variante="secundario" onClick={() => setSugerencias(null)}>
                Volver a generar
              </Button>
              <Button type="button" disabled={seleccionadas.length === 0 || creando} onClick={() => onCrear(seleccionadas.map(({ titulo, prioridad }) => ({ titulo, prioridad })))}>
                {creando ? 'Creando…' : `Crear ${seleccionadas.length} tarea(s)`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
