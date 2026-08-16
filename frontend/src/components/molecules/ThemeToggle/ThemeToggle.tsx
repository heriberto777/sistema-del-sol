import { useTheme } from '../../../hooks/useTheme';

export function ThemeToggle() {
  const { tema, toggleTema } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTema}
      aria-label={tema === 'claro' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
      className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {tema === 'claro' ? 'Oscuro' : 'Claro'}
    </button>
  );
}
