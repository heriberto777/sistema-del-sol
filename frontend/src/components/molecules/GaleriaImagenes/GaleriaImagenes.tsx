import { useRef, useState } from 'react';
import { ImageOff, Upload, X } from 'lucide-react';
import { comprimirImagen } from '../../../lib/comprimir-imagen';

interface GaleriaImagenesProps {
  valores: string[];
  onChange: (valores: string[]) => void;
  label?: string;
}

/**
 * Fotos adicionales de un producto para la Tienda Online (Fase 5) — a
 * diferencia de `CampoImagen` (un solo valor), esto maneja una lista.
 * Reusa `comprimirImagen()` por archivo, sin cambios a esa función. El
 * orden se guarda tal cual el array (índice = `orden` al mandar al
 * backend) — sin drag-and-drop, reordenar es quitar y volver a agregar.
 */
export function GaleriaImagenes({ valores, onChange, label = 'Fotos adicionales' }: GaleriaImagenesProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  async function onSeleccionar(archivos: FileList | null) {
    if (!archivos?.length) return;
    setError(null);
    setProcesando(true);
    try {
      const nuevas = await Promise.all(Array.from(archivos).map((archivo) => comprimirImagen(archivo)));
      onChange([...valores, ...nuevas]);
    } catch {
      setError('No se pudo procesar alguna imagen — probá con otro archivo.');
    } finally {
      setProcesando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function quitar(indice: number) {
    onChange(valores.filter((_, i) => i !== indice));
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        {valores.map((valor, indice) => (
          <div key={indice} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <img src={valor} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => quitar(indice)}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {valores.length === 0 && (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
            <ImageOff size={18} className="text-slate-300 dark:text-slate-600" />
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={procesando}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Upload size={14} />
          {procesando ? 'Procesando…' : 'Agregar fotos'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onSeleccionar(e.target.files)} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
