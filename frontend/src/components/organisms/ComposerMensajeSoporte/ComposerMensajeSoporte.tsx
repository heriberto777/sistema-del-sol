import { useState, type ChangeEvent, type ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Paperclip, Send, X } from 'lucide-react';

const EXTENSIONES = [
  StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false, strike: false, code: false }),
];

// ~5MB en bytes — el archivo viaja como base64 (33% más grande), igual
// criterio de límite fijo que el resto de adjuntos de este proyecto
// (ImagenProducto no tiene límite explícito porque son imágenes de
// producto subidas por el admin; acá sí hace falta por ser cualquier
// archivo cargado por cualquier usuario).
const LIMITE_ADJUNTO_BYTES = 5 * 1024 * 1024;

export interface PayloadMensajeSoporte {
  cuerpo: object;
  adjuntoBase64?: string;
  adjuntoNombre?: string;
}

/**
 * Editor enriquecido (Tiptap — negrita/cursiva/listas) + adjunto + enviar.
 * Compartido entre la conversación del tenant y la de plataforma — ambos
 * lados solo difieren en qué hacen con el payload al enviarlo.
 */
export function ComposerMensajeSoporte({
  onEnviar,
  enviando,
  disabled,
  accionesExtra,
}: {
  onEnviar: (payload: PayloadMensajeSoporte) => void;
  enviando: boolean;
  disabled?: boolean;
  /** Slot extra junto al botón Enviar (ej. el selector "Cambiar estado" de plataforma). */
  accionesExtra?: ReactNode;
}) {
  const [adjunto, setAdjunto] = useState<{ base64: string; nombre: string } | null>(null);
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null);

  const editor = useEditor({
    extensions: EXTENSIONES,
    content: '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'min-h-[2.5rem] max-h-40 overflow-y-auto px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none',
      },
    },
  });

  function onElegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setErrorAdjunto(null);
    if (archivo.size > LIMITE_ADJUNTO_BYTES) {
      setErrorAdjunto('El archivo supera el límite de 5MB.');
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = lector.result as string;
      const base64 = resultado.split(',')[1] ?? resultado;
      setAdjunto({ base64, nombre: archivo.name });
    };
    lector.readAsDataURL(archivo);
  }

  function enviar() {
    if (!editor || editor.isEmpty || enviando) return;
    onEnviar({ cuerpo: editor.getJSON(), adjuntoBase64: adjunto?.base64, adjuntoNombre: adjunto?.nombre });
    editor.commands.clearContent();
    setAdjunto(null);
    setErrorAdjunto(null);
  }

  if (!editor) return null;

  return (
    <div className="border-t border-slate-200 p-3 dark:border-slate-700">
      {adjunto && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800">
          <Paperclip size={12} className="shrink-0 text-slate-400" />
          <span className="flex-1 truncate">{adjunto.nombre}</span>
          <button type="button" onClick={() => setAdjunto(null)} aria-label="Quitar adjunto" className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={12} />
          </button>
        </div>
      )}
      {errorAdjunto && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{errorAdjunto}</p>}
      <div className="rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1 dark:border-slate-700">
          <BotonFormato activo={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} icono={<Bold size={14} />} etiqueta="Negrita" />
          <BotonFormato activo={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} icono={<Italic size={14} />} etiqueta="Cursiva" />
          <BotonFormato activo={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} icono={<List size={14} />} etiqueta="Lista" />
          <BotonFormato
            activo={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            icono={<ListOrdered size={14} />}
            etiqueta="Lista numerada"
          />
          <label
            className="ml-auto cursor-pointer rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            title="Adjuntar archivo"
          >
            <Paperclip size={14} />
            <input type="file" className="hidden" onChange={onElegirArchivo} accept="image/*,application/pdf" />
          </label>
        </div>
        <EditorContent editor={editor} />
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        {accionesExtra}
        <button
          type="button"
          disabled={enviando || editor.isEmpty}
          onClick={enviar}
          className="flex items-center gap-1.5 rounded-lg bg-sol-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          <Send size={14} />
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

function BotonFormato({ activo, onClick, icono, etiqueta }: { activo: boolean; onClick: () => void; icono: ReactNode; etiqueta: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={etiqueta}
      aria-label={etiqueta}
      className={`rounded p-1.5 ${
        activo ? 'bg-sol-100 text-sol-700 dark:bg-sol-900/40 dark:text-sol-300' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
      }`}
    >
      {icono}
    </button>
  );
}
