import { ReporteInventario } from '../../components/organisms/ReporteInventario/ReporteInventario';
import { RequierePermiso } from '../../components/organisms/RequierePermiso/RequierePermiso';

export function ReportesInventario() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Reporte de Inventario</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Stock y rotación por sucursal.</p>
      </div>
      <RequierePermiso permiso="reportes.ver">
        <ReporteInventario />
      </RequierePermiso>
    </div>
  );
}
