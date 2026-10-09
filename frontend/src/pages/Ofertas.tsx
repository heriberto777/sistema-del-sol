import { OfertasPanel } from '../components/organisms/OfertasPanel/OfertasPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Ofertas() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Ofertas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Descuentos y promociones por producto, categoría o carrito completo — se aplican solas al facturar o cotizar.
        </p>
      </div>
      <RequierePermiso permiso="ofertas.ver">
        <OfertasPanel />
      </RequierePermiso>
    </div>
  );
}
