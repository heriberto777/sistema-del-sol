import { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

interface CardProps {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  /** Clases para el `<section>` exterior (borde/fondo/tamaño) — ej. "overflow-x-auto" o "h-full". */
  className?: string;
  /**
   * Clases de layout para el contenedor real de `children` (ej. "flex
   * flex-wrap items-end gap-3" para una fila de filtros). Nunca pasar
   * `flex`/`grid` en `className` esperando que afecte a los hijos: `children`
   * se renderiza en un `<div>` interno aparte (el mismo que agrega el `p-5` y
   * conviven con el `<header>` de título/acciones), así que esas clases
   * quedarían en el `<section>` exterior sin efecto visible sobre los hijos.
   */
  contentClassName?: string;
  /** Para tablas/listados que deben llegar hasta el borde — quita el padding del cuerpo. */
  sinPadding?: boolean;
}

/** Sección visual con encabezado propio — para separar bloques de una página (formulario, tabla, listado) en vez de apilarlos sin jerarquía. */
export function Card({ titulo, descripcion, acciones, children, className, contentClassName, sinPadding }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {(titulo || acciones) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            {titulo && <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>}
            {descripcion && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>}
          </div>
          {acciones}
        </header>
      )}
      <div className={cn(sinPadding ? undefined : 'p-5', contentClassName)}>{children}</div>
    </section>
  );
}
