import { ConfiguracionesPanel } from '../components/organisms/ConfiguracionesPanel/ConfiguracionesPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { VolverAConfiguracion } from '../components/molecules/VolverAConfiguracion/VolverAConfiguracion';

export function Parametros() {
  return (
    <div className="space-y-4">
      <VolverAConfiguracion />
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Parámetros generales</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">ITBIS, plazos de pago y otros valores de negocio del tenant.</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <ConfiguracionesPanel />
      </RequierePermiso>
    </div>
  );
}
