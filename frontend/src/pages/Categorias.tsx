import { CategoriasPanel } from '../components/organisms/CategoriasPanel/CategoriasPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Categorias() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Categorías</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Organización del catálogo de productos — usadas en Productos, la Tienda Online y las Ofertas.
        </p>
      </div>
      <RequierePermiso permiso="precios.ver">
        <CategoriasPanel />
      </RequierePermiso>
    </div>
  );
}
