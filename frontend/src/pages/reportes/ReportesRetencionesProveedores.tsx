import { RetencionesProveedoresView } from '../../components/organisms/RetencionesProveedoresView/RetencionesProveedoresView';
import { RequierePermiso } from '../../components/organisms/RequierePermiso/RequierePermiso';

export function ReportesRetencionesProveedores() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Retenciones a proveedores</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">ISR/ITBIS retenido a proveedores al pagarles una orden de compra.</p>
      </div>
      <RequierePermiso permiso="reportes.ver">
        <RetencionesProveedoresView />
      </RequierePermiso>
    </div>
  );
}
