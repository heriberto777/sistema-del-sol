import { LealtadPanel } from '../components/organisms/LealtadPanel/LealtadPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { VolverAConfiguracion } from '../components/molecules/VolverAConfiguracion/VolverAConfiguracion';

export function Lealtad() {
  return (
    <div className="space-y-4">
      <VolverAConfiguracion />
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Lealtad</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Programa de puntos — se ganan solos al facturar y se canjean como forma de pago en el checkout.
        </p>
      </div>
      <RequierePermiso permiso="lealtad.ver">
        <LealtadPanel />
      </RequierePermiso>
    </div>
  );
}
