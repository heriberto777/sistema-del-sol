import { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Para tablas/listados que deben llegar hasta el borde — quita el padding del cuerpo. */
  sinPadding?: boolean;
}

/** Sección visual con encabezado propio — para separar bloques de una página (formulario, tabla, listado) en vez de apilarlos sin jerarquía. */
export function Card({ titulo, descripcion, acciones, children, className, sinPadding }: CardProps) {
  return (
    <section
      className={clsx(
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
      <div className={sinPadding ? undefined : 'p-5'}>{children}</div>
    </section>
  );
}
