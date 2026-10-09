import { PuestosPanel } from '../components/organisms/PuestosPanel/PuestosPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Puestos() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Puestos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Catálogo de puestos de trabajo asignables a un empleado.</p>
      </div>
      <RequierePermiso permiso="nomina.ver">
        <PuestosPanel />
      </RequierePermiso>
    </div>
  );
}
