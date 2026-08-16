import clsx from 'clsx';

interface SwitchProps {
  activo: boolean;
  onChange: (valor: boolean) => void;
  disabled?: boolean;
}

export function Switch({ activo, onChange, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={clsx(
        'relative h-6 w-11 rounded-full transition-colors disabled:opacity-50',
        activo ? 'bg-sol-500' : 'bg-slate-300 dark:bg-slate-700',
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
          activo ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
