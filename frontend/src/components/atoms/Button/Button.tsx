import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'peligro';
}

const VARIANTES: Record<NonNullable<ButtonProps['variante']>, string> = {
  primario: 'bg-sol-500 text-white hover:bg-sol-600',
  secundario: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100',
  peligro: 'bg-red-600 text-white hover:bg-red-700',
};

export function Button({ variante = 'primario', className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTES[variante],
        className,
      )}
      {...props}
    />
  );
}
