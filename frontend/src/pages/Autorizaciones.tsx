import { AutorizacionesPanel } from '../components/organisms/AutorizacionesPanel/AutorizacionesPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { VolverAConfiguracion } from '../components/molecules/VolverAConfiguracion/VolverAConfiguracion';

export function Autorizaciones() {
  return (
    <div className="space-y-4">
      <VolverAConfiguracion />
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Autorizaciones</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Confirmación de PIN/2FA para anular facturas o procesar devoluciones.</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <AutorizacionesPanel />
      </RequierePermiso>
    </div>
  );
}
