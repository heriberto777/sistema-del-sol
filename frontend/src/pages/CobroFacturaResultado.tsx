import { useSearchParams } from 'react-router-dom';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';

/**
 * `?estado=` lo arma el backend DESPUÉS de verificar server-side la
 * respuesta real de AZUL/CardNet (ver cobros-publicos.controller.ts) —
 * nunca se reenvían los query params crudos del proveedor, así que esta
 * página no tiene forma de "fingir" un pago aprobado desde la URL.
 */
export function CobroFacturaResultado() {
  const [params] = useSearchParams();
  const estado = params.get('estado');

  const mensaje =
    estado === 'aprobado'
      ? { texto: 'Tu pago fue recibido.', tono: 'text-emerald-600 dark:text-emerald-400' }
      : estado === 'cancelado'
        ? { texto: 'Cancelaste el pago — no se realizó ningún cargo.', tono: 'text-slate-500 dark:text-slate-400' }
        : { texto: 'El pago no pudo procesarse.', tono: 'text-red-600 dark:text-red-400' };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-3 rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-sol-600 dark:text-sol-400">El Sistema del Sol</h1>
        <p className={mensaje.tono}>{mensaje.texto}</p>
        {estado === 'aprobado' && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Puede tardar unos segundos en reflejarse. Ya puedes cerrar esta página.</p>
        )}
      </div>
    </div>
  );
}
