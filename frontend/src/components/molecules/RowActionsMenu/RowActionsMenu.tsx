import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { inferirIconoAccion } from '../../../lib/inferir-icono-accion';

interface Accion {
  etiqueta: string;
  onClick: () => void;
  tono?: 'peligro';
  /** Si se omite, se infiere de la etiqueta (ver `inferirIconoAccion`) — no hace falta tocar cada llamado para tener íconos consistentes. */
  icono?: LucideIcon;
}

/**
 * Menú de "más acciones" por fila — trigger con ícono real (no el
 * carácter "⋮" plano de antes, muy poco descubrible) y el panel
 * desplegable se renderiza vía portal a `document.body` con posición
 * `fixed` calculada del botón: así nunca se corta contra el
 * `overflow-x-auto` de la tabla contenedora (antes sí podía pasar, ver
 * ARCHITECTURE.md/notas de la fase de UI).
 */
export function RowActionsMenu({ acciones }: { acciones: Accion[] }) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    function onClickFuera(e: MouseEvent) {
      const objetivo = e.target as Node;
      if (menuRef.current?.contains(objetivo) || botonRef.current?.contains(objetivo)) return;
      setAbierto(false);
    }
    function cerrar() {
      setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', onClickFuera);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [abierto]);

  function alternar() {
    if (!abierto && botonRef.current) {
      const rect = botonRef.current.getBoundingClientRect();
      const ANCHO_MENU = 176; // w-44
      setPosicion({ top: rect.bottom + 4, left: Math.min(rect.right - ANCHO_MENU, window.innerWidth - ANCHO_MENU - 8) });
    }
    setAbierto((v) => !v);
  }

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={alternar}
        className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Más acciones"
      >
        <MoreVertical size={16} />
      </button>
      {abierto &&
        posicion &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: posicion.top, left: posicion.left }}
            className="z-50 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            {acciones.map((accion) => {
              const Icono = accion.icono ?? inferirIconoAccion(accion.etiqueta);
              return (
                <button
                  key={accion.etiqueta}
                  type="button"
                  onClick={() => {
                    setAbierto(false);
                    accion.onClick();
                  }}
                  className={clsx(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    accion.tono === 'peligro'
                      ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {Icono && <Icono size={15} className="shrink-0" />}
                  {accion.etiqueta}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
