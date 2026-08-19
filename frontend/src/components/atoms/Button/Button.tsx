import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'peligro';
}

const VARIANTES: Record<NonNullable<ButtonProps['variante']>, string> = {
  primario: 'bg-sol-500 text-white shadow-sm hover:bg-sol-600 focus-visible:ring-sol-500/50',
  secundario:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700 focus-visible:ring-slate-400/50',
  peligro: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500/50',
};

export function Button({ variante = 'primario', className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-950',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTES[variante],
        className,
      )}
      {...props}
    />
  );
}
