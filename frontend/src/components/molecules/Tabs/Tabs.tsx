import clsx from 'clsx';

export interface Pestana<T extends string> {
  id: T;
  etiqueta: string;
  /** Punto rojo — ej. un error de validación en un campo que vive en una pestaña no activa, para que no quede invisible. */
  conAviso?: boolean;
}

interface TabsProps<T extends string> {
  pestanas: readonly Pestana<T>[];
  activa: T;
  onCambiar: (id: T) => void;
}

/** Mismo estilo visual que las pestañas de ProyectoDetalle.tsx (subrayado, sin fondo) — generalizado acá para modales de formulario largo con secciones bien distintas. */
export function Tabs<T extends string>({ pestanas, activa, onCambiar }: TabsProps<T>) {
  return (
    <div className="flex gap-4 overflow-x-auto border-b border-slate-200 dark:border-slate-800" role="tablist">
      {pestanas.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={activa === p.id}
          onClick={() => onCambiar(p.id)}
          className={clsx(
            'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium',
            activa === p.id
              ? 'border-sol-500 text-sol-600 dark:text-sol-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400',
          )}
        >
          {p.etiqueta}
          {p.conAviso && <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-label="Requiere atención" />}
        </button>
      ))}
    </div>
  );
}
