import { PlantillasHorarioPanel } from '../components/organisms/PlantillasHorarioPanel/PlantillasHorarioPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function PlantillasHorario() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Plantillas de horario</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Horarios reutilizables para asignar rápido a varios empleados.</p>
      </div>
      <RequierePermiso permiso="rrhh.ver">
        <PlantillasHorarioPanel />
      </RequierePermiso>
    </div>
  );
}
