import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { CrmMetasVentaPanel } from '../components/organisms/CrmMetasVentaPanel/CrmMetasVentaPanel';

export function CrmMetasVenta() {
  return (
    <RequierePermiso permiso="crm.reportes.ver">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Metas de venta</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Objetivo mensual por vendedor, comparado contra lo realmente ganado en el Pipeline.</p>
        </div>
        <CrmMetasVentaPanel />
      </div>
    </RequierePermiso>
  );
}
