import { FormEvent, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Paperclip, X } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { Select } from '../components/atoms/Select/Select';
import { useHayCambios } from '../hooks/useHayCambios';

type Categoria = 'BUG' | 'DUDA' | 'SOLICITUD' | 'OTRO';

const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  BUG: 'Algo no funciona',
  DUDA: 'Duda',
  SOLICITUD: 'Solicitud / idea',
  OTRO: 'Otro',
};

const EXTENSIONES = [
  StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false, strike: false, code: false }),
];

const LIMITE_ADJUNTO_BYTES = 5 * 1024 * 1024;

/** "Crear" de un reporte de Soporte — página propia (regla "Crear va en página, nunca en modal"). Reemplaza al formulario inline que tenía Soporte.tsx antes del rediseño. */
export function SoporteNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [asunto, setAsunto] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('DUDA');
  const [cuerpoVacio, setCuerpoVacio] = useState(true);
  const [adjunto, setAdjunto] = useState<{ base64: string; nombre: string } | null>(null);
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cuerpoRef = useRef<JSONContent>({ type: 'doc', content: [] });

  const editor = useEditor({
    extensions: EXTENSIONES,
    content: '',
    onUpdate: ({ editor }) => {
      cuerpoRef.current = editor.getJSON();
      setCuerpoVacio(editor.isEmpty);
    },
    editorProps: {
      attributes: {
        class: 'min-h-[8rem] max-h-80 overflow-y-auto px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none',
      },
    },
  });

  function onElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
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

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/reportes-tenant', {
        asunto,
        categoria,
        cuerpo: cuerpoRef.current,
        adjuntoBase64: adjunto?.base64,
        adjuntoNombre: adjunto?.nombre,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportes-tenant'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de crear bien.
      confirmarGuardado();
      setTimeout(() => navigate('/soporte'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo enviar el reporte.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ asunto, categoria, cuerpoVacio, adjuntoNombre: adjunto?.nombre });

  return (
    <PaginaDocumento
      titulo="Nuevo reporte"
      rutaVolver="/soporte"
      etiquetaVolver="Volver a Soporte"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Categoría</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ETIQUETA_CATEGORIA[categoria]}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nuevo-reporte" disabled={crear.isPending || cuerpoVacio || !asunto.trim()} className="w-full">
            {crear.isPending ? 'Enviando…' : 'Enviar reporte'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/soporte')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nuevo-reporte" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Información del reporte">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem]">
            <div className="flex flex-col gap-1">
              <label htmlFor="soporte-asunto" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Asunto
              </label>
              <input
                id="soporte-asunto"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                required
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="soporte-categoria" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Categoría
              </label>
              <Select id="soporte-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>
                {Object.entries(ETIQUETA_CATEGORIA).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción</label>
            <p className="text-xs text-slate-500 dark:text-slate-400">Contanos qué pasó o qué necesitás — cuanto más detalle, más rápido lo podemos resolver.</p>

            {adjunto && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800">
                <Paperclip size={12} className="shrink-0 text-slate-400" />
                <span className="flex-1 truncate">{adjunto.nombre}</span>
                <button type="button" onClick={() => setAdjunto(null)} aria-label="Quitar adjunto" className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                  <X size={12} />
                </button>
              </div>
            )}
            {errorAdjunto && <p className="text-xs text-red-600 dark:text-red-400">{errorAdjunto}</p>}

            <div className="rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1 dark:border-slate-700">
                <BotonFormato activo={!!editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} icono={<Bold size={14} />} etiqueta="Negrita" />
                <BotonFormato activo={!!editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} icono={<Italic size={14} />} etiqueta="Cursiva" />
                <BotonFormato
                  activo={!!editor?.isActive('bulletList')}
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  icono={<List size={14} />}
                  etiqueta="Lista"
                />
                <BotonFormato
                  activo={!!editor?.isActive('orderedList')}
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  icono={<ListOrdered size={14} />}
                  etiqueta="Lista numerada"
                />
                <label className="ml-auto cursor-pointer rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" title="Adjuntar archivo">
                  <Paperclip size={14} />
                  <input type="file" className="hidden" onChange={onElegirArchivo} accept="image/*,application/pdf" />
                </label>
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>
        </Card>
      </form>
    </PaginaDocumento>
  );
}

function BotonFormato({ activo, onClick, icono, etiqueta }: { activo: boolean; onClick: () => void; icono: React.ReactNode; etiqueta: string }) {
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
