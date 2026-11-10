import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { AjustesInventarioPanel } from '../../components/organisms/AjustesInventarioPanel/AjustesInventarioPanel';
import { TABS_INVENTARIO } from './tabs';

export function InventarioAjustes() {
  return (
    <ModuloPestanas titulo="Inventario" descripcion="Bodegas y existencias por producto." tabs={TABS_INVENTARIO} permiso="inventario.ver">
      <AjustesInventarioPanel />
    </ModuloPestanas>
  );
}
