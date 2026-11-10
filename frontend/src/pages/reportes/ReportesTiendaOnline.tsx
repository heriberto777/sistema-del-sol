import { ReporteTiendaOnline } from '../../components/organisms/ReporteTiendaOnline/ReporteTiendaOnline';
import { RequierePermiso } from '../../components/organisms/RequierePermiso/RequierePermiso';

export function ReportesTiendaOnline() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Reporte de Tienda Online</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Pedidos y ventas del storefront público.</p>
      </div>
      <RequierePermiso permiso="reportes.ver">
        <ReporteTiendaOnline />
      </RequierePermiso>
    </div>
  );
}
