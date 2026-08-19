import { CotizacionesPanel } from '../components/organisms/CotizacionesPanel/CotizacionesPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Cotizaciones() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Cotizaciones</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Propuestas de venta que podés convertir en factura al aceptarse.</p>
      </div>
      <RequierePermiso permiso="cotizaciones.ver">
        <CotizacionesPanel />
      </RequierePermiso>
    </div>
  );
}
