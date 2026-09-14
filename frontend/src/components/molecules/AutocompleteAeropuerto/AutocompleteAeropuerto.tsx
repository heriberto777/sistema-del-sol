import { useEffect, useRef, useState } from 'react';
import { Aeropuerto, aeropuertoPorCodigo, buscarAeropuertos } from '../../../data/aeropuertos';
import { cn } from '../../../lib/cn';

export function AutocompleteAeropuerto({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  /** Código IATA seleccionado (o lo que el usuario esté escribiendo, si no coincide con ninguno). */
  value: string;
  onChange: (codigo: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [texto, setTexto] = useState(() => {
    const a = aeropuertoPorCodigo(value);
    return a ? `${a.ciudad} (${a.codigo})` : value;
  });
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  // Si el código cambia desde afuera (ej. botón de intercambiar), resincronizar el texto mostrado.
  useEffect(() => {
    const a = aeropuertoPorCodigo(value);
    setTexto(a ? `${a.ciudad} (${a.codigo})` : value);
  }, [value]);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  const sugerencias = buscarAeropuertos(texto);

  function elegir(a: Aeropuerto) {
    onChange(a.codigo);
    setTexto(`${a.ciudad} (${a.codigo})`);
    setAbierto(false);
  }

  return (
    <div ref={contenedorRef} className="relative flex flex-1 flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input
        type="text"
        value={texto}
        required={required}
        placeholder={placeholder ?? 'Ciudad, país o código'}
        onChange={(e) => {
          setTexto(e.target.value);
          onChange(e.target.value.toUpperCase());
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        className={cn(
          'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors',
          'placeholder:text-slate-400',
          'focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30',
          'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
        )}
        autoComplete="off"
      />
      {abierto && sugerencias.length > 0 && (
        <div className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {sugerencias.map((a) => (
            <button
              type="button"
              key={a.codigo}
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(a);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span className="text-lg leading-none">{a.bandera}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-800 dark:text-slate-100">
                  {a.ciudad}, {a.pais}
                </span>
                <span className="block truncate text-xs text-slate-400">{a.nombre}</span>
              </span>
              <span className="shrink-0 rounded bg-sol-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-sol-700 dark:bg-sol-500/10 dark:text-sol-400">
                {a.codigo}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
