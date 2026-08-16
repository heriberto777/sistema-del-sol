import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface Accion {
  etiqueta: string;
  onClick: () => void;
  tono?: 'peligro';
}

/**
 * Menú de "más acciones" por fila (⋮) — sin librería externa, cierra al
 * hacer click fuera. Reemplaza los botones de texto sueltos por fila
 * cuando una fila tiene más de una acción posible.
 */
export function RowActionsMenu({ acciones }: { acciones: Accion[] }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Más acciones"
      >
        ⋮
      </button>
      {abierto && (
        <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {acciones.map((accion) => (
            <button
              key={accion.etiqueta}
              type="button"
              onClick={() => {
                setAbierto(false);
                accion.onClick();
              }}
              className={clsx(
                'block w-full px-3 py-2 text-left text-sm',
                accion.tono === 'peligro'
                  ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {accion.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
