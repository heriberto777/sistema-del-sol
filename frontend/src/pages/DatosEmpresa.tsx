import { TenantEmpresaPanel } from '../components/organisms/TenantEmpresaPanel/TenantEmpresaPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function DatosEmpresa() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Datos de mi empresa</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">RNC, razón social y datos fiscales del negocio.</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <TenantEmpresaPanel />
      </RequierePermiso>
    </div>
  );
}
