import { AsistenteWidget } from '../components/organisms/AsistenteWidget/AsistenteWidget';
import { SugerirCuentaWidget } from '../components/organisms/SugerirCuentaWidget/SugerirCuentaWidget';
import { DescripcionProductoWidget } from '../components/organisms/DescripcionProductoWidget/DescripcionProductoWidget';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Ia() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">IA</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Asistente y herramientas que degradan a heurística sin API key configurada.</p>
      </div>
      <RequierePermiso permiso="ia.usar">
        <div className="space-y-4">
          <AsistenteWidget />
          <SugerirCuentaWidget />
          <DescripcionProductoWidget />
        </div>
      </RequierePermiso>
    </div>
  );
}
