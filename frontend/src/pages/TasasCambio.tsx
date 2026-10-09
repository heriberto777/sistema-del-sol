import { TasasCambioPanel } from '../components/organisms/TasasCambioPanel/TasasCambioPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function TasasCambio() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tasas de cambio</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Monedas disponibles para facturar y su tasa frente al peso dominicano.</p>
      </div>
      <RequierePermiso permiso="facturacion.crear">
        <TasasCambioPanel />
      </RequierePermiso>
    </div>
  );
}
