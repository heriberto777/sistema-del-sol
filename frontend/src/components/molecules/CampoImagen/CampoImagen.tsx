import { useRef, useState } from 'react';
import { ImageOff, Upload } from 'lucide-react';
import { comprimirImagen } from '../../../lib/comprimir-imagen';

interface CampoImagenProps {
  valor: string | null;
  onChange: (dataUri: string | null) => void;
  label?: string;
}

/** Subida de imagen con vista previa — comprime en el navegador (ver comprimir-imagen.ts) antes de entregar el data URI. */
export function CampoImagen({ valor, onChange, label = 'Foto' }: CampoImagenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  async function onSeleccionar(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setProcesando(true);
    try {
      onChange(await comprimirImagen(archivo));
    } catch {
      setError('No se pudo procesar la imagen — probá con otro archivo.');
    } finally {
      setProcesando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          {valor ? (
            <img src={valor} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff size={20} className="text-slate-300 dark:text-slate-600" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={procesando}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Upload size={14} />
            {procesando ? 'Procesando…' : valor ? 'Cambiar' : 'Subir foto'}
          </button>
          {valor && (
            <button type="button" onClick={() => onChange(null)} className="text-left text-xs text-red-600 hover:underline dark:text-red-400">
              Quitar foto
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onSeleccionar(e.target.files?.[0])} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
