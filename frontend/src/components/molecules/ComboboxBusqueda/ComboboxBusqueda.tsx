import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

interface ComboboxBusquedaProps<T> {
  id?: string;
  valor: T | null;
  onSeleccionar: (item: T | null) => void;
  buscar: (texto: string) => Promise<T[]>;
  obtenerId: (item: T) => string;
  obtenerEtiqueta: (item: T) => string;
  placeholder?: string;
}

/**
 * Buscador con autocompletado genérico — reemplaza los <select> nativos
 * de 100 registros (sin buscador, truncados) usados para Cliente/Producto.
 * Quien lo usa provee el `buscar(texto)` (ya sea `/clientes?busqueda=` o
 * `/productos?busqueda=`, ambos ya soportados por el backend).
 */
export function ComboboxBusqueda<T>({
  id,
  valor,
  onSeleccionar,
  buscar,
  obtenerId,
  obtenerEtiqueta,
  placeholder,
}: ComboboxBusquedaProps<T>) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [opciones, setOpciones] = useState<T[]>([]);
  const [cargando, setCargando] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const textoDebounced = useDebouncedValue(texto, 300);

  useEffect(() => {
    if (!abierto || textoDebounced.trim().length === 0) {
      setOpciones([]);
      return;
    }
    let cancelado = false;
    setCargando(true);
    buscar(textoDebounced)
      .then((resultados) => {
        if (!cancelado) setOpciones(resultados);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoDebounced, abierto]);

  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e: MouseEvent) {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  if (valor) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
        <span className="flex-1 truncate">{obtenerEtiqueta(valor)}</span>
        <button
          type="button"
          onClick={() => onSeleccionar(null)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Cambiar selección"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div ref={contenedorRef} className="relative">
      <input
        id={id}
        type="text"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        placeholder={placeholder ?? 'Buscar…'}
        autoComplete="off"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      {abierto && texto.trim().length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {cargando && <p className="px-3 py-2 text-sm text-slate-400">Buscando…</p>}
          {!cargando && opciones.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">Sin resultados</p>}
          {!cargando &&
            opciones.map((op) => (
              <button
                key={obtenerId(op)}
                type="button"
                onClick={() => {
                  onSeleccionar(op);
                  setTexto('');
                  setAbierto(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {obtenerEtiqueta(op)}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
