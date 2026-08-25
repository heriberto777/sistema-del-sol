import { useRef, useState } from 'react';
import { ImageOff, Upload } from 'lucide-react';
import { comprimirImagen } from '../../../lib/comprimir-imagen';
import { AJUSTES_IMAGEN, CLASE_AJUSTE_IMAGEN, type AjusteImagen } from '../../../constants/ajuste-imagen';
import { Select } from '../../atoms/Select/Select';
import { cn } from '../../../lib/cn';

interface CampoImagenProps {
  valor: string | null;
  onChange: (dataUri: string | null) => void;
  label?: string;
  /** Cómo encajar la imagen dentro de su recuadro donde se muestre (ej. tarjeta del catálogo del POS) — ver AJUSTES_IMAGEN. */
  ajuste?: AjusteImagen;
  onChangeAjuste?: (ajuste: AjusteImagen) => void;
}

/**
 * Subida de imagen con vista previa — comprime en el navegador (ver
 * comprimir-imagen.ts) antes de entregar el data URI. El selector de
 * "ajuste" (`onChangeAjuste`) es opcional: sin él, se comporta igual que
 * antes (miniatura en `object-cover` fijo) — lo usa `FormularioProducto`
 * en Productos.tsx, que es hoy el único lugar donde el ajuste importa de
 * verdad (la tarjeta del catálogo del POS).
 */
export function CampoImagen({ valor, onChange, label = 'Foto', ajuste = 'COVER', onChangeAjuste }: CampoImagenProps) {
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
            <img src={valor} alt="" className={cn('h-full w-full', CLASE_AJUSTE_IMAGEN[ajuste])} />
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
      {onChangeAjuste && (
        <div className="mt-1 flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Cómo mostrarla en la tarjeta del POS</label>
          <Select value={ajuste} onChange={(e) => onChangeAjuste(e.target.value as AjusteImagen)} className="max-w-xs">
            {AJUSTES_IMAGEN.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-400">{AJUSTES_IMAGEN.find((a) => a.value === ajuste)?.descripcion}</p>
        </div>
      )}
    </div>
  );
}
