import { ReactNode, RefObject, useState } from 'react';
import { Bold, Code2, Italic, Paperclip, Smile, Underline } from 'lucide-react';

/**
 * Extraído de TareaPersonalModal.tsx (Mis Tareas) para reusarlo tal cual
 * en los comentarios de tarea de Proyectos — mismo formato (negrita/
 * cursiva/subrayado/bloque de código/emoji), un solo lugar de verdad.
 */

const EMOJIS_SUGERIDOS = ['✅', '👍', '🎉', '🐛', '⚠️', '🔥', '💡', '📌', '⏰', '❌', '🙌', '👀', '🤔', '🚀', '💬', '🙏', '😀', '😅', '😞', '🎯', '📅', '🔧', '✔️', '📎'];

/** Envuelve la selección actual del textarea con marcas ```así``` (o inserta un placeholder si no hay nada seleccionado) — mismo patrón que cualquier editor tipo Word/Discord. */
export function envolverSeleccion(
  ref: RefObject<HTMLTextAreaElement>,
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

export function insertarEnCursor(ref: RefObject<HTMLTextAreaElement>, valor: string, onChange: (v: string) => void, texto: string) {
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

/** Fila de íconos compartida entre "agregar nota"/"editar nota" (Mis Tareas) y el comentario de tarea de Proyectos — solo el textarea/imagen quedan a cargo de quien la usa. */
export function BarraFormato({
  textareaRef,
  valor,
  onChange,
  mostrarImagen,
  onSeleccionarImagen,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
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

export function ContenidoComentario({ contenido }: { contenido: string }) {
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
