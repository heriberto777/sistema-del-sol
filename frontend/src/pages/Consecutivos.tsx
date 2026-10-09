import { CorrelativosPanel } from '../components/organisms/CorrelativosPanel/CorrelativosPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Consecutivos() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Consecutivos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Numeración interna de cotizaciones, remisiones y otros documentos.</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <CorrelativosPanel />
      </RequierePermiso>
    </div>
  );
}
