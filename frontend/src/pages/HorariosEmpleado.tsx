import { HorarioEmpleadoPanel } from '../components/organisms/HorarioEmpleadoPanel/HorarioEmpleadoPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function HorariosEmpleado() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Horarios</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Horario semanal asignado a cada empleado.</p>
      </div>
      <RequierePermiso permiso="rrhh.ver">
        <HorarioEmpleadoPanel />
      </RequierePermiso>
    </div>
  );
}
