import { RemisionesPanel } from '../components/organisms/RemisionesPanel/RemisionesPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Remisiones() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Remisiones</h1>
      <RequierePermiso permiso="remisiones.ver">
        <RemisionesPanel />
      </RequierePermiso>
    </div>
  );
}
