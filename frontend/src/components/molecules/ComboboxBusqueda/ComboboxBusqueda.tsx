import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

interface ComboboxBusquedaProps<T> {
  id?: string;
  valor: T | null;
  onSeleccionar: (item: T | null) => void;
  buscar: (texto: string) => Promise<T[]>;
  obtenerId: (item: T) => string;
  obtenerEtiqueta: (item: T) => string;
  placeholder?: string;
  /** Ícono opcional dentro del campo (ej. Cliente/Vendedor en Caja) — puramente visual, no cambia el comportamiento. */
  icono?: ReactNode;
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
  icono,
}: ComboboxBusquedaProps<T>) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [opciones, setOpciones] = useState<T[]>([]);
  const [cargando, setCargando] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState({ top: 0, left: 0, width: 0 });
  const textoDebounced = useDebouncedValue(texto, 300);
  const mostrarLista = abierto && texto.trim().length > 0;

  // El desplegable se porta a `document.body` (ver más abajo) para escapar
  // de ancestros con `overflow` recortado — ej. el wrapper `overflow-x-auto`
  // de TablaLineasEditable, que por la regla de la spec CSS ("si un eje es
  // `visible` y el otro no, el `visible` pasa a `auto`") termina recortando
  // en Y cualquier hijo `position: absolute` aunque visualmente debería
  // sobresalir. Reposicionarlo en cada apertura/scroll/resize es necesario
  // porque, al vivir fuera del árbol del contenedor, ya no se mueve solo
  // con el layout de este.
  useLayoutEffect(() => {
    if (!mostrarLista) return;
    function actualizarPosicion() {
      const rect = contenedorRef.current?.getBoundingClientRect();
      if (rect) setPosicion({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    actualizarPosicion();
    window.addEventListener('scroll', actualizarPosicion, true);
    window.addEventListener('resize', actualizarPosicion);
    return () => {
      window.removeEventListener('scroll', actualizarPosicion, true);
      window.removeEventListener('resize', actualizarPosicion);
    };
  }, [mostrarLista]);

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
    setResaltado(0);
  }, [opciones]);

  function seleccionar(op: T) {
    onSeleccionar(op);
    setTexto('');
    setAbierto(false);
  }

  function onKeyDownInput(e: KeyboardEvent<HTMLInputElement>) {
    if (opciones.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setResaltado((r) => (r + 1) % opciones.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResaltado((r) => (r - 1 + opciones.length) % opciones.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      seleccionar(opciones[resaltado]);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  }

  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e: MouseEvent) {
      const objetivo = e.target as Node;
      // `listaRef` también se revisa porque el desplegable vive portado a
      // `document.body` (fuera del árbol de `contenedorRef`) — sin este
      // chequeo, el mousedown sobre una opción cerraría la lista antes de
      // que el click en ella llegara a dispararse.
      if (!contenedorRef.current?.contains(objetivo) && !listaRef.current?.contains(objetivo)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  if (valor) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
        {icono && <span className="shrink-0 text-slate-400 dark:text-slate-500">{icono}</span>}
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
      {icono && (
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400 dark:text-slate-500">
          {icono}
        </span>
      )}
      <input
        id={id}
        type="text"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={onKeyDownInput}
        placeholder={placeholder ?? 'Buscar…'}
        autoComplete="off"
        className={`w-full rounded-md border border-slate-300 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${icono ? 'pl-8 pr-3' : 'px-3'}`}
      />
      {mostrarLista &&
        createPortal(
          <div
            ref={listaRef}
            style={{ position: 'fixed', top: posicion.top + 4, left: posicion.left, width: posicion.width }}
            className="z-50 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            {cargando && <p className="px-3 py-2 text-sm text-slate-400">Buscando…</p>}
            {!cargando && opciones.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">Sin resultados</p>}
            {!cargando &&
              opciones.map((op, i) => (
                <button
                  key={obtenerId(op)}
                  type="button"
                  onMouseEnter={() => setResaltado(i)}
                  onClick={() => seleccionar(op)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    i === resaltado
                      ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/30 dark:text-sol-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {obtenerEtiqueta(op)}
                </button>
              ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
