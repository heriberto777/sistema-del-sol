import { AsistenciaTable } from '../components/organisms/AsistenciaTable/AsistenciaTable';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Asistencia() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Asistencia</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Marcas de entrada/salida del personal y aprobación de horas extra.</p>
      </div>
      <RequierePermiso permiso="rrhh.ver">
        <AsistenciaTable />
      </RequierePermiso>
    </div>
  );
}
