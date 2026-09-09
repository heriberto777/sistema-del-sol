import { FormEvent, useState } from 'react';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { ESTADOS_TAREA, ETIQUETA_ESTADO_TAREA, Hito, PRIORIDADES_TAREA, ETIQUETA_PRIORIDAD_TAREA, Tarea } from '../../../types/proyectos';

export interface TareaFormValues {
  titulo: string;
  descripcion?: string;
  hitoId: string | null;
  prioridad: string;
  estado?: string;
  fechaVencimiento?: string;
}

interface TareaFormModalProps {
  tareaInicial?: Tarea;
  hitos: Hito[];
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onGuardar: (valores: TareaFormValues) => void;
}

/** Mismo modal para crear y editar — el estado solo se pide al editar (al crear siempre arranca en Pendiente, igual que hoy). */
export function TareaFormModal({ tareaInicial, hitos, guardando, error, onClose, onGuardar }: TareaFormModalProps) {
  const [titulo, setTitulo] = useState(tareaInicial?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(tareaInicial?.descripcion ?? '');
  const [hitoId, setHitoId] = useState(tareaInicial?.hitoId ?? '');
  const [prioridad, setPrioridad] = useState(tareaInicial?.prioridad ?? 'MEDIA');
  const [estado, setEstado] = useState(tareaInicial?.estado ?? 'PENDIENTE');
  const [fechaVencimiento, setFechaVencimiento] = useState(tareaInicial?.fechaVencimiento ? tareaInicial.fechaVencimiento.slice(0, 10) : '');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    onGuardar({
      titulo,
      descripcion: descripcion || undefined,
      hitoId: hitoId || null,
      prioridad,
      estado: tareaInicial ? estado : undefined,
      fechaVencimiento: fechaVencimiento || undefined,
    });
  }

  return (
    <Modal titulo={tareaInicial ? 'Editar tarea' : 'Nueva tarea'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="tarea-titulo" label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} required autoFocus />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción (opcional)</label>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Hito (opcional)</label>
            <Select value={hitoId} onChange={(e) => setHitoId(e.target.value)}>
              <option value="">Sin hito</option>
              {hitos.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prioridad</label>
            <Select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              {PRIORIDADES_TAREA.map((p) => (
                <option key={p} value={p}>
                  {ETIQUETA_PRIORIDAD_TAREA[p]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="tarea-fecha-vencimiento"
            label="Fecha de vencimiento (opcional)"
            type="date"
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
          />
          {tareaInicial && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado</label>
              <Select value={estado} onChange={(e) => setEstado(e.target.value)}>
                {ESTADOS_TAREA.map((es) => (
                  <option key={es} value={es}>
                    {ETIQUETA_ESTADO_TAREA[es]}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : tareaInicial ? 'Guardar cambios' : 'Crear tarea'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
