import { FormEvent, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsLeft, ChevronsRight, Maximize2, MessageSquare, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { comprimirImagen } from '../../../lib/comprimir-imagen';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { Modal } from '../../molecules/Modal/Modal';
import { BarraFormato, ContenidoComentario } from '../../molecules/ComentarioFormato/ComentarioFormato';
import {
  CategoriaIncentivo,
  ComentarioTareaPersonal,
  ESTADOS_TAREA_PERSONAL,
  ETIQUETAS_SUGERIDAS_NEGOCIO,
  ETIQUETAS_SUGERIDAS_TECNICO,
  ETIQUETA_ESTADO_TAREA_PERSONAL,
  ETIQUETA_PRIORIDAD_TAREA_PERSONAL,
  PRIORIDADES_TAREA_PERSONAL,
  TareaPersonal,
} from '../../../types/tareas-personales';

function formatoFechaHora(fecha: string): string {
  const d = new Date(fecha);
  return `${d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })}`;
}

/** Overlay simple para ver una imagen adjunta a tamaño completo — las miniaturas de 20x20 no alcanzan para leer texto/detalle dentro de una captura de pantalla. */
function VisorImagen({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Cerrar"
      >
        <X size={18} />
      </button>
      <img src={src} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function ComentarioItem({
  comentario,
  onEditar,
  editando,
  onEliminar,
  eliminando,
  onAmpliarImagen,
}: {
  comentario: ComentarioTareaPersonal;
  onEditar: (contenido: string) => void;
  editando: boolean;
  onEliminar: () => void;
  eliminando: boolean;
  onAmpliarImagen: (src: string) => void;
}) {
  const [modoEdicion, setModoEdicion] = useState(false);
  const [borrador, setBorrador] = useState(comentario.contenido);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (borrador.trim()) {
      onEditar(borrador.trim());
      setModoEdicion(false);
    }
  }

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
            {comentario.updatedAt !== comentario.createdAt && <span className="text-slate-300"> · editado</span>}
          </p>
          {!modoEdicion && (
            <div className="flex shrink-0 gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => setModoEdicion(true)} className="text-slate-300 hover:text-slate-600" aria-label="Editar nota">
                <Pencil size={12} />
              </button>
              <button type="button" onClick={onEliminar} disabled={eliminando} className="text-slate-300 hover:text-red-600" aria-label="Eliminar nota">
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {modoEdicion ? (
          <form onSubmit={guardar} className="mt-1.5 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <textarea
              ref={textareaRef}
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              rows={2}
              autoFocus
              className="w-full resize-none border-none bg-transparent text-[13px] text-slate-900 outline-none dark:text-slate-100"
            />
            <div className="mt-1 flex items-center justify-between">
              <BarraFormato textareaRef={textareaRef} valor={borrador} onChange={setBorrador} />
              <div className="flex gap-1.5">
                <Button type="button" variante="secundario" onClick={() => { setModoEdicion(false); setBorrador(comentario.contenido); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!borrador.trim() || editando}>
                  Guardar
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="mt-1">
            <ContenidoComentario contenido={comentario.contenido} />
          </div>
        )}

        {comentario.imagenes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {comentario.imagenes.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onAmpliarImagen(img)}
                className="group relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                aria-label="Ver imagen más grande"
              >
                <img src={img} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
                  <Maximize2 size={14} className="text-white" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ETIQUETAS_SUGERIDAS = [...ETIQUETAS_SUGERIDAS_NEGOCIO, ...ETIQUETAS_SUGERIDAS_TECNICO];

export function TareaPersonalModal({ tarea, onClose }: { tarea: TareaPersonal; onClose: () => void }) {
  const queryClient = useQueryClient();
  // 'mistareas' está en los 3 planes pero 'ia' solo en Premium — sin este
  // chequeo, un tenant Básico/Profesional vería el botón y le fallaría con
  // 403 al primer clic (el guard real sigue siendo 100% del backend).
  const { tieneModulo, tienePermiso } = useAuth();
  const puedeGenerarConIa = tieneModulo('ia') && tienePermiso('ia.usar');
  const [contenido, setContenido] = useState('');
  const [imagenesPendientes, setImagenesPendientes] = useState<string[]>([]);
  const [etiquetaNueva, setEtiquetaNueva] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState(tarea.descripcion ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Igual criterio que KanbanTareas.tsx: sesión de "estoy leyendo esto ahora", no persiste entre aperturas.
  const [panelNotasAbierto, setPanelNotasAbierto] = useState(true);

  const { data: categorias } = useQuery({
    queryKey: ['categorias-incentivo'],
    queryFn: async () => (await apiClient.get<CategoriaIncentivo[]>('/admin/categorias-incentivo')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['mis-tareas'] });
  }

  const actualizar = useMutation({
    mutationFn: async (dto: Partial<Pick<TareaPersonal, 'titulo' | 'descripcion' | 'prioridad' | 'estado' | 'fecha' | 'etiquetas' | 'categoriaIncentivoId'>>) =>
      apiClient.patch(`/admin/mis-tareas/${tarea.id}`, dto),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el cambio.')),
  });

  const generarDescripcionIa = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{ descripcion: string; generadaConIa: boolean }>('/ia/generar-descripcion-tarea', {
          titulo: tarea.titulo,
          categoria: tarea.categoriaIncentivo?.nombre,
        })
      ).data,
    onSuccess: (data) => {
      if (data.descripcion) setDescripcion(data.descripcion);
      else setError('La IA no está configurada todavía (falta la API key en Plataforma) — escribí la descripción a mano.');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo generar la descripción con IA.')),
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

  const editarComentario = useMutation({
    mutationFn: async ({ id, contenido: nuevo }: { id: string; contenido: string }) =>
      apiClient.patch(`/admin/mis-tareas/comentarios/${id}`, { contenido: nuevo }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo editar la nota.')),
  });

  const eliminarComentario = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/mis-tareas/comentarios/${id}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar la nota.')),
  });

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

  function agregarEtiqueta(valor: string) {
    const limpio = valor.trim();
    if (!limpio || tarea.etiquetas.includes(limpio) || tarea.etiquetas.length >= 8) return;
    actualizar.mutate({ etiquetas: [...tarea.etiquetas, limpio] });
    setEtiquetaNueva('');
  }

  function quitarEtiqueta(valor: string) {
    actualizar.mutate({ etiquetas: tarea.etiquetas.filter((e) => e !== valor) });
  }

  return (
    <Modal titulo={tarea.titulo} onClose={onClose} ancho="full">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setPanelNotasAbierto((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <MessageSquare size={13} />
          Notas
          {tarea.comentarios.length > 0 && (
            <span className="rounded-full bg-sol-500 px-1.5 text-[10px] font-bold text-white">{tarea.comentarios.length}</span>
          )}
          {panelNotasAbierto ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
        </button>
      </div>

      <div className={clsx('flex flex-col gap-5 md:items-start', panelNotasAbierto && 'md:flex-row')}>
      <div className="min-w-0 flex-1 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Título</label>
            <input
              defaultValue={tarea.titulo}
              onBlur={(e) => e.target.value.trim() && e.target.value !== tarea.titulo && actualizar.mutate({ titulo: e.target.value.trim() })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
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

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Categoría de incentivo</label>
          <Select
            value={tarea.categoriaIncentivoId ?? ''}
            onChange={(e) => actualizar.mutate({ categoriaIncentivoId: e.target.value || null })}
            className="max-w-sm"
          >
            <option value="">Sin incentivo (no aplica)</option>
            {categorias
              ?.filter((c) => c.activa || c.id === tarea.categoriaIncentivoId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · ${Number(c.peso).toLocaleString('es-DO')}
                </option>
              ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción (opcional)</label>
            {puedeGenerarConIa && (
              <button
                type="button"
                onClick={() => generarDescripcionIa.mutate()}
                disabled={generarDescripcionIa.isPending}
                className="flex items-center gap-1 rounded-lg border border-sol-200 bg-sol-50 px-2.5 py-1 text-xs font-semibold text-sol-700 hover:bg-sol-100 disabled:opacity-50 dark:border-sol-500/30 dark:bg-sol-500/10 dark:text-sol-400"
              >
                <Sparkles size={12} />
                {generarDescripcionIa.isPending ? 'Generando…' : 'Generar con IA'}
              </button>
            )}
          </div>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            onBlur={() => descripcion !== (tarea.descripcion ?? '') && actualizar.mutate({ descripcion: descripcion || null })}
            rows={7}
            placeholder="Detalle ampliado del problema o la tarea…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Etiquetas</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {tarea.etiquetas.map((et) => (
              <span key={et} className="flex items-center gap-1 rounded-full bg-sol-50 px-2.5 py-1 text-xs font-medium text-sol-700 dark:bg-sol-500/10 dark:text-sol-300">
                {et}
                <button type="button" onClick={() => quitarEtiqueta(et)} className="text-sol-400 hover:text-sol-700" aria-label={`Quitar etiqueta ${et}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
            {tarea.etiquetas.length < 8 && (
              <input
                value={etiquetaNueva}
                onChange={(e) => setEtiquetaNueva(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    agregarEtiqueta(etiquetaNueva);
                  }
                }}
                placeholder="Agregar etiqueta…"
                className="min-w-[110px] flex-1 rounded-full border border-dashed border-slate-300 bg-transparent px-2.5 py-1 text-xs outline-none focus:border-sol-400 dark:border-slate-600 dark:text-slate-100"
              />
            )}
          </div>
          {tarea.etiquetas.length < 8 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-slate-400">Sugeridas:</span>
              {ETIQUETAS_SUGERIDAS.filter((s) => !tarea.etiquetas.includes(s)).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => agregarEtiqueta(s)}
                  className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 hover:border-sol-300 hover:text-sol-600 dark:border-slate-700 dark:text-slate-400"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {panelNotasAbierto && (
        <div className="flex flex-col border-t border-slate-100 pt-5 dark:border-slate-800 md:h-[36rem] md:w-96 md:shrink-0 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <h3 className="mb-1 shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Notas{tarea.comentarios.length > 0 && <span className="ml-1 font-normal text-slate-400">({tarea.comentarios.length})</span>}
          </h3>

          {/* min-h-0 es lo que permite que este flex item se encoja por debajo de su contenido y el overflow-y-auto de abajo scrollee de verdad (mismo criterio que KanbanTareas.tsx). */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {tarea.comentarios.length === 0 && <p className="py-2 text-xs text-slate-400">Sin notas todavía — escribí algo abajo.</p>}
            {tarea.comentarios.map((c) => (
              <ComentarioItem
                key={c.id}
                comentario={c}
                editando={editarComentario.isPending}
                onEditar={(nuevo) => editarComentario.mutate({ id: c.id, contenido: nuevo })}
                eliminando={eliminarComentario.isPending}
                onEliminar={() => eliminarComentario.mutate(c.id)}
                onAmpliarImagen={setImagenAmpliada}
              />
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-3 shrink-0 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
            <textarea
              ref={textareaRef}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Escribí una nota — usá ``` para un bloque de código…"
              rows={3}
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
              <BarraFormato textareaRef={textareaRef} valor={contenido} onChange={setContenido} mostrarImagen onSeleccionarImagen={onSeleccionarImagen} />
              <Button type="submit" disabled={!contenido.trim() || agregarComentario.isPending}>
                {agregarComentario.isPending ? 'Enviando…' : 'Comentar'}
              </Button>
            </div>
          </form>
        </div>
      )}
      </div>
      {imagenAmpliada && <VisorImagen src={imagenAmpliada} onClose={() => setImagenAmpliada(null)} />}
    </Modal>
  );
}
