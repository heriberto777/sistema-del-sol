import { CategoriasProveedorPanel } from '../components/organisms/CategoriasProveedorPanel/CategoriasProveedorPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function CategoriasProveedor() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Categorías de proveedor</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Agrupación de proveedores para clasificación y análisis de compras.</p>
      </div>
      <RequierePermiso permiso="compras.ver">
        <CategoriasProveedorPanel />
      </RequierePermiso>
    </div>
  );
}
