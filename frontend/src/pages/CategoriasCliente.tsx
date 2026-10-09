import { CategoriasClientePanel } from '../components/organisms/CategoriasClientePanel/CategoriasClientePanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function CategoriasCliente() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Categorías de cliente</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Agrupación de clientes para listas de precio y comprobante fiscal por defecto.</p>
      </div>
      <RequierePermiso permiso="clientes.ver">
        <CategoriasClientePanel />
      </RequierePermiso>
    </div>
  );
}
