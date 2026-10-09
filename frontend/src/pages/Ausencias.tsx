import { AusenciasTable } from '../components/organisms/AusenciasTable/AusenciasTable';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Ausencias() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Ausencias</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Vacaciones y otras ausencias registradas, con su balance disponible.</p>
      </div>
      <RequierePermiso permiso="rrhh.ver">
        <AusenciasTable />
      </RequierePermiso>
    </div>
  );
}
