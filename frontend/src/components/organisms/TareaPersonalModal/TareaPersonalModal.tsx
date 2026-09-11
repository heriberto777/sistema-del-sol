import { FormEvent, ReactNode, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bold, Code2, Italic, Maximize2, Paperclip, Pencil, Smile, Trash2, Underline, X } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { comprimirImagen } from '../../../lib/comprimir-imagen';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { Modal } from '../../molecules/Modal/Modal';
import {
  ComentarioTareaPersonal,
  ESTADOS_TAREA_PERSONAL,
  ETIQUETAS_SUGERIDAS_NEGOCIO,
  ETIQUETAS_SUGERIDAS_TECNICO,
  ETIQUETA_ESTADO_TAREA_PERSONAL,
  ETIQUETA_PRIORIDAD_TAREA_PERSONAL,
  PRIORIDADES_TAREA_PERSONAL,
  TareaPersonal,
} from '../../../types/tareas-personales';

const EMOJIS_SUGERIDOS = ['✅', '👍', '🎉', '🐛', '⚠️', '🔥', '💡', '📌', '⏰', '❌', '🙌', '👀', '🤔', '🚀', '💬', '🙏', '😀', '😅', '😞', '🎯', '📅', '🔧', '✔️', '📎'];

/** Envuelve la selección actual del textarea con marcas ```así``` (o inserta un placeholder si no hay nada seleccionado) — mismo patrón que cualquier editor tipo Word/Discord. */
function envolverSeleccion(
  ref: React.RefObject<HTMLTextAreaElement>,
  valor: string,
  onChange: (v: string) => void,
  marcaInicio: string,
  marcaFin: string,
  placeholder: string,
) {
  const el = ref.current;
  const inicio = el?.selectionStart ?? valor.length;
  const fin = el?.selectionEnd ?? valor.length;
  const seleccionado = valor.slice(inicio, fin) || placeholder;
  const nuevo = valor.slice(0, inicio) + marcaInicio + seleccionado + marcaFin + valor.slice(fin);
  onChange(nuevo);
  requestAnimationFrame(() => {
    el?.focus();
    const pos = inicio + marcaInicio.length + seleccionado.length + marcaFin.length;
    el?.setSelectionRange(pos, pos);
  });
}

function insertarEnCursor(ref: React.RefObject<HTMLTextAreaElement>, valor: string, onChange: (v: string) => void, texto: string) {
  const el = ref.current;
  const pos = el?.selectionStart ?? valor.length;
  onChange(valor.slice(0, pos) + texto + valor.slice(pos));
  requestAnimationFrame(() => {
    el?.focus();
    el?.setSelectionRange(pos + texto.length, pos + texto.length);
  });
}

/** Separa texto plano de bloques ```código``` — el resaltado (acá y el de negrita/cursiva/subrayado) es puramente de presentación, nunca se interpreta más allá de esto. */
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

/** `**negrita**` / `*cursiva*` / `__subrayado__` — mismo criterio que Discord, sin librería de markdown. */
function renderizarTextoConFormato(texto: string, keyPrefix: string): ReactNode[] {
  const nodos: ReactNode[] = [];
  const regex = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*)/g;
  let ultimo = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(texto))) {
    if (match.index > ultimo) nodos.push(texto.slice(ultimo, match.index));
    const token = match[0];
    if (token.startsWith('**')) nodos.push(<strong key={`${keyPrefix}-${i++}`}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('__')) nodos.push(<u key={`${keyPrefix}-${i++}`}>{token.slice(2, -2)}</u>);
    else nodos.push(<em key={`${keyPrefix}-${i++}`}>{token.slice(1, -1)}</em>);
    ultimo = regex.lastIndex;
  }
  if (ultimo < texto.length) nodos.push(texto.slice(ultimo));
  return nodos;
}

function formatoFechaHora(fecha: string): string {
  const d = new Date(fecha);
  return `${d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })}`;
}

/** Fila de íconos compartida entre "agregar nota" y "editar nota" — solo el textarea/imagen quedan a cargo de quien lo usa. */
function BarraFormato({
  textareaRef,
  valor,
  onChange,
  mostrarImagen,
  onSeleccionarImagen,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  valor: string;
  onChange: (v: string) => void;
  mostrarImagen?: boolean;
  onSeleccionarImagen?: (archivo: File | undefined) => void;
}) {
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const boton = 'flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200';

  return (
    <div className="relative flex items-center gap-0.5">
      <button type="button" title="Negrita" className={boton} onClick={() => envolverSeleccion(textareaRef, valor, onChange, '**', '**', 'negrita')}>
        <Bold size={15} />
      </button>
      <button type="button" title="Cursiva" className={boton} onClick={() => envolverSeleccion(textareaRef, valor, onChange, '*', '*', 'cursiva')}>
        <Italic size={15} />
      </button>
      <button type="button" title="Subrayado" className={boton} onClick={() => envolverSeleccion(textareaRef, valor, onChange, '__', '__', 'subrayado')}>
        <Underline size={15} />
      </button>
      <button type="button" title="Bloque de código" className={boton} onClick={() => envolverSeleccion(textareaRef, valor, onChange, '```\n', '\n```', 'código')}>
        <Code2 size={15} />
      </button>
      <button type="button" title="Emoji" className={boton} onClick={() => setEmojiAbierto((v) => !v)}>
        <Smile size={15} />
      </button>
      {emojiAbierto && (
        <div className="absolute bottom-9 left-0 z-10 grid w-52 grid-cols-6 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {EMOJIS_SUGERIDOS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                insertarEnCursor(textareaRef, valor, onChange, emoji);
                setEmojiAbierto(false);
              }}
              className="rounded p-1 text-base hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {mostrarImagen && (
        <label title="Adjuntar imagen" className={`${boton} cursor-pointer`}>
          <Paperclip size={15} />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onSeleccionarImagen?.(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}

function ContenidoComentario({ contenido }: { contenido: string }) {
  const partes = segmentarContenido(contenido);
  return (
    <div className="space-y-2">
      {partes.map((p, i) =>
        p.tipo === 'codigo' ? (
          <pre key={i} className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-[11.5px] leading-relaxed text-slate-100">
            <code>{p.valor}</code>
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {renderizarTextoConFormato(p.valor.trim(), `p${i}`)}
          </p>
        ),
      )}
    </div>
  );
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
  const [contenido, setContenido] = useState('');
  const [imagenesPendientes, setImagenesPendientes] = useState<string[]>([]);
  const [etiquetaNueva, setEtiquetaNueva] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['mis-tareas'] });
  }

  const actualizar = useMutation({
    mutationFn: async (dto: Partial<Pick<TareaPersonal, 'titulo' | 'prioridad' | 'estado' | 'fecha' | 'etiquetas'>>) =>
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
    <Modal titulo={tarea.titulo} onClose={onClose} ancho="xl">
      <div className="space-y-4">
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

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Notas{tarea.comentarios.length > 0 && <span className="ml-1 font-normal text-slate-400">({tarea.comentarios.length})</span>}
          </h3>

          <div className="max-h-[26rem] overflow-y-auto pr-1">
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

          <form onSubmit={onSubmit} className="mt-3 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
            <textarea
              ref={textareaRef}
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
              <BarraFormato textareaRef={textareaRef} valor={contenido} onChange={setContenido} mostrarImagen onSeleccionarImagen={onSeleccionarImagen} />
              <Button type="submit" disabled={!contenido.trim() || agregarComentario.isPending}>
                {agregarComentario.isPending ? 'Enviando…' : 'Comentar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
      {imagenAmpliada && <VisorImagen src={imagenAmpliada} onClose={() => setImagenAmpliada(null)} />}
    </Modal>
  );
}
