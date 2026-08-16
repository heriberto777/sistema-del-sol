import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  tono?: 'neutro' | 'exito' | 'advertencia' | 'peligro';
}

const TONOS: Record<NonNullable<BadgeProps['tono']>, string> = {
  neutro: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  exito: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  advertencia: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  peligro: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export function Badge({ children, tono = 'neutro' }: BadgeProps) {
  return (
    <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', TONOS[tono])}>{children}</span>
  );
}
