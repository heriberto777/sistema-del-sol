import { CajasPanel } from '../components/organisms/CajasPanel/CajasPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Cajas() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Cajas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Terminales físicas de Punto de Venta — cada una puede limitarse a un catálogo o vender todo por defecto.
        </p>
      </div>
      <RequierePermiso permiso="pos.ver">
        <CajasPanel />
      </RequierePermiso>
    </div>
  );
}
