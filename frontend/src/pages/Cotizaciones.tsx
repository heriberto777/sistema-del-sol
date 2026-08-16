import { CotizacionesPanel } from '../components/organisms/CotizacionesPanel/CotizacionesPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Cotizaciones() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Cotizaciones</h1>
      <RequierePermiso permiso="cotizaciones.ver">
        <CotizacionesPanel />
      </RequierePermiso>
    </div>
  );
}
