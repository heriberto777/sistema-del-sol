import { FormasPagoPanel } from '../components/organisms/FormasPagoPanel/FormasPagoPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function FormasPago() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Formas de pago</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Métodos de cobro disponibles al facturar y en el Punto de Venta — efectivo, bonos, puntos de lealtad y más.
        </p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <FormasPagoPanel />
      </RequierePermiso>
    </div>
  );
}
