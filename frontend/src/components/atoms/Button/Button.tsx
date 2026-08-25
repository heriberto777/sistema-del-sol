import { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { inferirIconoAccion } from '../../../lib/inferir-icono-accion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'peligro';
  /**
   * Ícono al inicio del botón (lucide-react) — ej. `icon={Plus}`. Si se
   * omite, se infiere del texto del botón (`inferirIconoAccion`, mismo
   * criterio que `RowActionsMenu`) siempre que sea un string simple — no
   * hace falta pasarlo a mano en cada botón para tener íconos
   * consistentes. Pasar `icon={null}` desactiva la inferencia en un botón
   * puntual (ej. texto ambiguo, o un botón muy angosto donde el ícono no
   * entra bien).
   */
  icon?: LucideIcon | null;
}

const VARIANTES: Record<NonNullable<ButtonProps['variante']>, string> = {
  primario: 'bg-sol-500 text-white shadow-sm hover:bg-sol-600 focus-visible:ring-sol-500/50',
  secundario:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700 focus-visible:ring-slate-400/50',
  peligro: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500/50',
};

function textoPlano(children: ReactNode): string | null {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  return null;
}

export function Button({ variante = 'primario', icon, className, children, ...props }: ButtonProps) {
  const texto = textoPlano(children);
  const Icon = icon === null ? undefined : (icon ?? (texto ? inferirIconoAccion(texto) : undefined));

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-950',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTES[variante],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}
