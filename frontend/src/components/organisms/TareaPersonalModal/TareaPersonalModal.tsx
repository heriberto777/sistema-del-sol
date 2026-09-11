import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Code2, Paperclip, Trash2, X } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { comprimirImagen } from '../../../lib/comprimir-imagen';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { Modal } from '../../molecules/Modal/Modal';
import {
  ComentarioTareaPersonal,
  ESTADOS_TAREA_PERSONAL,
  ETIQUETA_ESTADO_TAREA_PERSONAL,
  ETIQUETA_PRIORIDAD_TAREA_PERSONAL,
  PRIORIDADES_TAREA_PERSONAL,
  TareaPersonal,
} from '../../../types/tareas-personales';

/** Separa el texto plano de los bloques ```código``` — el resaltado es puramente de presentación, nunca se interpreta más allá de esto. */
function segmentarContenido(texto: string): { tipo: 'texto' | 'codigo'; valor: string }[] {
  const partes: { tipo: 'texto' | 'codigo'; valor: string }[] = [];
  const regex = /```[\w-]*\n?([\s\S]*?)```/g;
  let ultimo = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(texto))) {
    if (match.index > ultimo) partes.push({ tipo: 'texto', valor: texto.slice(ultimo, match.index) });
    partes.push({ tipo: 'codigo', valor: match[1].trimEnd() });
    ultimo = regex.lastIndex;
  }
  if (ultimo < texto.length) partes.push({ tipo: 'texto', valor: texto.slice(ultimo) });
  return partes.filter((p) => p.valor.trim().length > 0 || p.tipo === 'codigo');
}

function formatoFechaHora(fecha: string): string {
  const d = new Date(fecha);
  return `${d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })}`;
}

function ComentarioItem({ comentario, onEliminar, eliminando }: { comentario: ComentarioTareaPersonal; onEliminar: () => void; eliminando: boolean }) {
  const partes = segmentarContenido(comentario.contenido);
  return (
    <div className="group flex gap-2.5 border-b border-slate-100 py-2.5 first:pt-0 last:border-0 dark:border-slate-800">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sol-500 text-[10px] font-bold text-white">
        {comentario.autor.nombre.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{comentario.autor.nombre}</span>{' '}
            <span className="text-slate-400">{formatoFechaHora(comentario.createdAt)}</span>
          </p>
          <button
            type="button"
            onClick={onEliminar}
            disabled={eliminando}
            className="shrink-0 text-slate-300 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
            aria-label="Eliminar comentario"
          >
            <Trash2 size={12} />
          </button>
        </div>
        <div className="mt-1 space-y-2">
          {partes.map((p, i) =>
            p.tipo === 'codigo' ? (
              <pre key={i} className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-[11.5px] leading-relaxed text-slate-100">
                <code>{p.valor}</code>
              </pre>
            ) : (
              <p key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                {p.valor.trim()}
              </p>
            ),
          )}
        </div>
        {comentario.imagenes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {comentario.imagenes.map((img, i) => (
              <img key={i} src={img} alt="" className="h-20 w-20 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TareaPersonalModal({ tarea, onClose }: { tarea: TareaPersonal; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [contenido, setContenido] = useState('');
  const [imagenesPendientes, setImagenesPendientes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['mis-tareas'] });
  }

  const actualizar = useMutation({
    mutationFn: async (dto: Partial<Pick<TareaPersonal, 'titulo' | 'prioridad' | 'estado' | 'fecha'>>) =>
      apiClient.patch(`/admin/mis-tareas/${tarea.id}`, dto),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el cambio.')),
  });

  const agregarComentario = useMutation({
    mutationFn: async () => apiClient.post(`/admin/mis-tareas/${tarea.id}/comentarios`, { contenido: contenido.trim(), imagenes: imagenesPendientes }),
    onSuccess: () => {
      setContenido('');
      setImagenesPendientes([]);
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo agregar el comentario.')),
  });

  const eliminarComentario = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/mis-tareas/comentarios/${id}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar el comentario.')),
  });

  function insertarBloqueCodigo() {
    setContenido((c) => (c && !c.endsWith('\n') ? c + '\n```\n\n```' : c + '```\n\n```'));
  }

  async function onSeleccionarImagen(archivo: File | undefined) {
    if (!archivo) return;
    try {
      const dataUri = await comprimirImagen(archivo);
      setImagenesPendientes((imgs) => [...imgs, dataUri].slice(0, 4));
    } catch {
      setError('No se pudo procesar la imagen — probá con otro archivo.');
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (contenido.trim()) agregarComentario.mutate();
  }

  return (
    <Modal titulo={tarea.titulo} onClose={onClose} ancho="xl">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Título</label>
            <input
              defaultValue={tarea.titulo}
              onBlur={(e) => e.target.value.trim() && e.target.value !== tarea.titulo && actualizar.mutate({ titulo: e.target.value.trim() })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado</label>
              <Select value={tarea.estado} onChange={(e) => actualizar.mutate({ estado: e.target.value as TareaPersonal['estado'] })}>
                {ESTADOS_TAREA_PERSONAL.map((es) => (
                  <option key={es} value={es}>
                    {ETIQUETA_ESTADO_TAREA_PERSONAL[es]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prioridad</label>
              <Select value={tarea.prioridad} onChange={(e) => actualizar.mutate({ prioridad: e.target.value as TareaPersonal['prioridad'] })}>
                {PRIORIDADES_TAREA_PERSONAL.map((p) => (
                  <option key={p} value={p}>
                    {ETIQUETA_PRIORIDAD_TAREA_PERSONAL[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha (opcional)</label>
              <input
                type="date"
                defaultValue={tarea.fecha ? tarea.fecha.slice(0, 10) : ''}
                onChange={(e) => actualizar.mutate({ fecha: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex flex-col border-t border-slate-100 pt-5 dark:border-slate-800 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Notas{tarea.comentarios.length > 0 && <span className="ml-1 font-normal text-slate-400">({tarea.comentarios.length})</span>}
          </h3>

          <div className="max-h-56 overflow-y-auto pr-1 md:max-h-none md:flex-1">
            {tarea.comentarios.length === 0 && <p className="py-2 text-xs text-slate-400">Sin notas todavía — escribí algo abajo.</p>}
            {tarea.comentarios.map((c) => (
              <ComentarioItem
                key={c.id}
                comentario={c}
                eliminando={eliminarComentario.isPending}
                onEliminar={() => eliminarComentario.mutate(c.id)}
              />
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-3 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Escribí una nota — usá ``` para un bloque de código…"
              rows={2}
              className="w-full resize-none border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {imagenesPendientes.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {imagenesPendientes.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img} alt="" className="h-14 w-14 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
                    <button
                      type="button"
                      onClick={() => setImagenesPendientes((imgs) => imgs.filter((_, idx) => idx !== i))}
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-white"
                      aria-label="Quitar imagen"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={insertarBloqueCodigo}
                  title="Insertar bloque de código"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <Code2 size={15} />
                </button>
                <label
                  title="Adjuntar imagen"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <Paperclip size={15} />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onSeleccionarImagen(e.target.files?.[0])} />
                </label>
              </div>
              <Button type="submit" disabled={!contenido.trim() || agregarComentario.isPending}>
                {agregarComentario.isPending ? 'Enviando…' : 'Comentar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
