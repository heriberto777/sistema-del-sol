import { PersonalizacionDocumentosPanel } from '../components/organisms/PersonalizacionDocumentosPanel/PersonalizacionDocumentosPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Documentos() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Documentos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Logo y nota de pie que se imprimen en facturas, cotizaciones y remisiones.</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <PersonalizacionDocumentosPanel />
      </RequierePermiso>
    </div>
  );
}
