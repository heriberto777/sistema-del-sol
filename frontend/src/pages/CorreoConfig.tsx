import { EmailConfigPanel } from '../components/organisms/EmailConfigPanel/EmailConfigPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function CorreoConfig() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Correo (SMTP)</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Servidor de correo usado para enviar notificaciones por email.</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <EmailConfigPanel />
      </RequierePermiso>
    </div>
  );
}
