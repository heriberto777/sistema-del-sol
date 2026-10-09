import { WebhooksPanel } from '../components/organisms/WebhooksPanel/WebhooksPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Webhooks() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Webhooks</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Notificar a sistemas externos cuando pasan eventos del negocio.</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <WebhooksPanel />
      </RequierePermiso>
    </div>
  );
}
