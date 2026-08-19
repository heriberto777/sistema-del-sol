import { RemisionesPanel } from '../components/organisms/RemisionesPanel/RemisionesPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Remisiones() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Remisiones</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Entregas de mercancía sin facturar todavía.</p>
      </div>
      <RequierePermiso permiso="remisiones.ver">
        <RemisionesPanel />
      </RequierePermiso>
    </div>
  );
}
