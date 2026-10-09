import { LeyesFiscalesPanel } from '../components/organisms/LeyesFiscalesPanel/LeyesFiscalesPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function LeyesFiscales() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Leyes fiscales</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tasas de ITBIS reducido por ley — se asignan a productos específicos.</p>
      </div>
      <RequierePermiso permiso="precios.ver">
        <LeyesFiscalesPanel />
      </RequierePermiso>
    </div>
  );
}
