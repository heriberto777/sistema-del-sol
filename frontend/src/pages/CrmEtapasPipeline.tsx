import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { CrmEtapasPipelinePanel } from '../components/organisms/CrmEtapasPipelinePanel/CrmEtapasPipelinePanel';

export function CrmEtapasPipeline() {
  return (
    <RequierePermiso permiso="crm.ver">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Etapas del pipeline</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Configurá las columnas del Pipeline — Ganada/Perdida no son etapas, son el desenlace de una oportunidad.</p>
        </div>
        <CrmEtapasPipelinePanel />
      </div>
    </RequierePermiso>
  );
}
