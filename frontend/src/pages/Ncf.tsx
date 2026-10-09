import { NcfPanel } from '../components/organisms/NcfPanel/NcfPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Ncf() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">NCF</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Comprobantes fiscales disponibles para facturar.</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <NcfPanel />
      </RequierePermiso>
    </div>
  );
}
