import { WhatsappConfigPanel } from '../components/organisms/WhatsappConfigPanel/WhatsappConfigPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function WhatsappConfig() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">WhatsApp</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Conexión con Twilio para notificaciones y el bot de WhatsApp.</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <WhatsappConfigPanel />
      </RequierePermiso>
    </div>
  );
}
