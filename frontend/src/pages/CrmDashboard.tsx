import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { CrmDashboardPanel } from '../components/organisms/CrmDashboardPanel/CrmDashboardPanel';

export function CrmDashboard() {
  return (
    <RequierePermiso permiso="crm.reportes.ver">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard CRM</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Conversión de leads, forecast del pipeline y ranking de vendedores.</p>
        </div>
        <CrmDashboardPanel />
      </div>
    </RequierePermiso>
  );
}
