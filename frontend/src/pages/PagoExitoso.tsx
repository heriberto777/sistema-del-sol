import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';

export function PagoExitoso() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-3 rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-sol-600 dark:text-sol-400">El Sistema del Sol</h1>
        <p className="text-emerald-600 dark:text-emerald-400">Tu pago fue recibido.</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Puede tardar unos segundos en reflejarse como pagada. Ya puedes cerrar esta página.
        </p>
      </div>
    </div>
  );
}
