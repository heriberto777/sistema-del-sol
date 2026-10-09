import { AtributosPanel } from '../components/organisms/AtributosPanel/AtributosPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Atributos() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Atributos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Atributos de variante (Talla, Color) y sus valores — alimentan el armado de variantes en Productos.
        </p>
      </div>
      <RequierePermiso permiso="precios.ver">
        <AtributosPanel />
      </RequierePermiso>
    </div>
  );
}
