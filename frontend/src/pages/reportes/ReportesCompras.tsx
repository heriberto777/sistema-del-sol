import { ReporteCompras } from '../../components/organisms/ReporteCompras/ReporteCompras';
import { RequierePermiso } from '../../components/organisms/RequierePermiso/RequierePermiso';

export function ReportesCompras() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Reporte de Compras</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Compras a proveedores por período.</p>
      </div>
      <RequierePermiso permiso="reportes.ver">
        <ReporteCompras />
      </RequierePermiso>
    </div>
  );
}
