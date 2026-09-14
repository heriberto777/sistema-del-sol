import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { DestinoHotel } from '../../../types/travel';
import { cn } from '../../../lib/cn';

/**
 * A diferencia de AutocompleteAeropuerto (catálogo curado, local), el
 * catálogo de destinos de Hotelbeds vive en el backend (~7300 registros,
 * cacheados ahí — ver HotelbedsAdapter.obtenerCatalogoDestinos) porque no
 * son códigos IATA (confirmado en vivo: Santo Domingo es "DOM", no "SDQ").
 * Por eso este componente busca contra la API con debounce en vez de
 * filtrar una lista local.
 */
export function AutocompleteDestinoHotel({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (codigo: string) => void;
  required?: boolean;
}) {
  const [texto, setTexto] = useState(value);
  const [sugerencias, setSugerencias] = useState<DestinoHotel[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  function programarBusqueda(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await apiClient.get<DestinoHotel[]>('/admin/travel/hoteles/destinos', { params: { q: query.trim() } });
        setSugerencias(r.data);
      } catch {
        setSugerencias([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
  }

  function elegir(d: DestinoHotel) {
    onChange(d.codigo);
    setTexto(`${d.nombre}, ${d.pais}`);
    setAbierto(false);
    setSugerencias([]);
  }

  return (
    <div ref={contenedorRef} className="relative flex flex-1 flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input
        type="text"
        value={texto}
        required={required}
        placeholder="Ciudad, zona o país"
        onChange={(e) => {
          setTexto(e.target.value);
          onChange('');
          setAbierto(true);
          programarBusqueda(e.target.value);
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
      {abierto && (buscando || sugerencias.length > 0) && (
        <div className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {buscando && <p className="px-2.5 py-2 text-xs text-slate-400">Buscando…</p>}
          {!buscando &&
            sugerencias.map((d) => (
              <button
                type="button"
                key={d.codigo}
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(d);
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="text-lg leading-none">{d.bandera}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                  {d.nombre}, {d.pais}
                </span>
                <span className="shrink-0 rounded bg-sol-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-sol-700 dark:bg-sol-500/10 dark:text-sol-400">
                  {d.codigo}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
