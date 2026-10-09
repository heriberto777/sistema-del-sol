import { RolesPanel } from '../components/organisms/RolesPanel/RolesPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function RolesPermisos() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Roles y permisos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Qué puede ver y hacer cada rol en el sistema.</p>
      </div>
      <RequierePermiso permiso="admin.usuarios">
        <RolesPanel />
      </RequierePermiso>
    </div>
  );
}
