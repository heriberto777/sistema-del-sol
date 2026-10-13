import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { CrmPipelinePanel } from '../components/organisms/CrmPipelinePanel/CrmPipelinePanel';

export function CrmPipeline() {
  return (
    <RequierePermiso permiso="crm.ver">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Pipeline</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Oportunidades de venta por etapa, desde el primer contacto hasta ganar o perder.</p>
        </div>
        <CrmPipelinePanel />
      </div>
    </RequierePermiso>
  );
}
