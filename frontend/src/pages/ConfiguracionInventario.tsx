import { UnidadesMedidaPanel } from '../components/organisms/UnidadesMedidaPanel/UnidadesMedidaPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function ConfiguracionInventario() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Configuración de Inventario</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Unidades de medida — definí el catálogo del tenant (Unidad, Caja, Docena, etc.) para elegirlas como unidad
          base o de conversión en cada producto.
        </p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <UnidadesMedidaPanel />
      </RequierePermiso>
    </div>
  );
}
