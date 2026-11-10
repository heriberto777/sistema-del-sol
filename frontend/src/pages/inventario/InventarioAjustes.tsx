import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { AjustesInventarioPanel } from '../../components/organisms/AjustesInventarioPanel/AjustesInventarioPanel';

export function InventarioAjustes() {
  return (
    <ModuloPestanas titulo="Historial de ajustes" descripcion="Ajustes de inventario registrados." permiso="inventario.ver">
      <AjustesInventarioPanel />
    </ModuloPestanas>
  );
}
