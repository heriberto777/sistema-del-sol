import { BonosPanel } from '../components/organisms/BonosPanel/BonosPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Bonos() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Bonos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gift cards emitidas por lote, canjeables como forma de pago en el Punto de Venta.
        </p>
      </div>
      <RequierePermiso permiso="bonos.ver">
        <BonosPanel />
      </RequierePermiso>
    </div>
  );
}
