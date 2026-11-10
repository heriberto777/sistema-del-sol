import { ReporteInmobiliaria } from '../../components/organisms/ReporteInmobiliaria/ReporteInmobiliaria';
import { RequierePermiso } from '../../components/organisms/RequierePermiso/RequierePermiso';

export function ReportesInmobiliaria() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Reporte de Inmobiliaria</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Propiedades, contratos y cobros de alquiler.</p>
      </div>
      <RequierePermiso permiso="reportes.ver">
        <ReporteInmobiliaria />
      </RequierePermiso>
    </div>
  );
}
