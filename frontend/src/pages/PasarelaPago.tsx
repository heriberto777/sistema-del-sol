import { PasarelaCobroConfigPanel } from '../components/organisms/PasarelaCobroConfigPanel/PasarelaCobroConfigPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function PasarelaPago() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Pasarela de pago</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Cobro en línea de facturas vía Azul/CardNet.</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <PasarelaCobroConfigPanel />
      </RequierePermiso>
    </div>
  );
}
