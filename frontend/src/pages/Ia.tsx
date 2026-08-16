import { AsistenteWidget } from '../components/organisms/AsistenteWidget/AsistenteWidget';
import { SugerirCuentaWidget } from '../components/organisms/SugerirCuentaWidget/SugerirCuentaWidget';
import { DescripcionProductoWidget } from '../components/organisms/DescripcionProductoWidget/DescripcionProductoWidget';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Ia() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">IA</h1>
      <RequierePermiso permiso="ia.usar">
        <AsistenteWidget />
        <SugerirCuentaWidget />
        <DescripcionProductoWidget />
      </RequierePermiso>
    </div>
  );
}
