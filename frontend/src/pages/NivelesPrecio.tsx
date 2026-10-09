import { ListasPrecioPanel } from '../components/organisms/ListasPrecioPanel/ListasPrecioPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function NivelesPrecio() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Niveles de precio</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Listas de precio alternativas a GENERAL (ej. mayorista) — cada producto puede tener un precio distinto por nivel.
        </p>
      </div>
      <RequierePermiso permiso="precios.ver">
        <ListasPrecioPanel />
      </RequierePermiso>
    </div>
  );
}
