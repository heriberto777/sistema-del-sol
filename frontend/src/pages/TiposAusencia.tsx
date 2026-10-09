import { TiposAusenciaConfigPanel } from '../components/organisms/TiposAusenciaConfigPanel/TiposAusenciaConfigPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function TiposAusencia() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tipos de ausencia</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Qué tipos de ausencia existen y si descuentan de la nómina.</p>
      </div>
      <RequierePermiso permiso="rrhh.ver">
        <TiposAusenciaConfigPanel />
      </RequierePermiso>
    </div>
  );
}
