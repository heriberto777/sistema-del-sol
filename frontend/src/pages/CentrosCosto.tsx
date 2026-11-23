import { CentrosCostoPanel } from '../components/organisms/CentrosCostoPanel/CentrosCostoPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function CentrosCosto() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Centros de costo</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sucursales, departamentos o áreas — para etiquetar gastos, ventas y asientos y poder verlos segmentados en el Estado de Resultados.
        </p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <CentrosCostoPanel />
      </RequierePermiso>
    </div>
  );
}
