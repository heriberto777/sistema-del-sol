import { UsuariosPanel } from '../components/organisms/UsuariosPanel/UsuariosPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Usuarios() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Usuarios</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Cuentas de acceso al sistema y su rol asignado.</p>
      </div>
      <RequierePermiso permiso="admin.usuarios">
        <UsuariosPanel />
      </RequierePermiso>
    </div>
  );
}
