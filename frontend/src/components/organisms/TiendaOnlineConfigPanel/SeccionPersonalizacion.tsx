import { ReactNode } from 'react';
import clsx from 'clsx';

/** Agrupa visualmente los ~7 conceptos de la pestaña Personalización (Fase 15) — antes eran una sola columna continua sin ninguna separación. */
export function SeccionPersonalizacion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</h3>
      {descripcion && <p className="mb-3 mt-1 text-xs text-slate-500 dark:text-slate-400">{descripcion}</p>}
      <div className={clsx('flex flex-col gap-4', !descripcion && 'mt-3')}>{children}</div>
    </div>
  );
}
