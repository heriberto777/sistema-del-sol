import { TravelConfigPanel } from '../components/organisms/TravelConfigPanel/TravelConfigPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { VolverAConfiguracion } from '../components/molecules/VolverAConfiguracion/VolverAConfiguracion';

export function TravelConfig() {
  return (
    <div className="space-y-4">
      <VolverAConfiguracion />
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Viajes</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tu propia cuenta de Duffel (vuelos) y Hotelbeds (hoteles).</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <TravelConfigPanel />
      </RequierePermiso>
    </div>
  );
}
