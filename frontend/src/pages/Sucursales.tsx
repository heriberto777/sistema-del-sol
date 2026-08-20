import { SucursalesTable } from '../components/organisms/SucursalesTable/SucursalesTable';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Sucursales() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sucursales</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Locales físicos del negocio — cada uno agrupa una o más bodegas.</p>
      </div>

      <RequierePermiso permiso="sucursales.ver">
        <SucursalesTable />
      </RequierePermiso>
    </div>
  );
}
