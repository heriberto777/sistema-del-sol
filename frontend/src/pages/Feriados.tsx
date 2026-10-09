import { FeriadosTable } from '../components/organisms/FeriadosTable/FeriadosTable';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Feriados() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Feriados</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Calendario de días feriados — afecta el cálculo de horas extra y asistencia.</p>
      </div>
      <RequierePermiso permiso="rrhh.ver">
        <FeriadosTable />
      </RequierePermiso>
    </div>
  );
}
