import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { CrmLeadsPanel } from '../components/organisms/CrmLeadsPanel/CrmLeadsPanel';

export function CrmLeads() {
  return (
    <RequierePermiso permiso="crm.ver">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Leads</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Prospectos que todavía no son clientes — registralos, calificalos y hacé seguimiento.</p>
        </div>
        <CrmLeadsPanel />
      </div>
    </RequierePermiso>
  );
}
