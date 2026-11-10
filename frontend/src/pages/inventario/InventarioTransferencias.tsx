import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { TransferenciasInventarioPanel } from '../../components/organisms/TransferenciasInventarioPanel/TransferenciasInventarioPanel';
import { TABS_INVENTARIO } from './tabs';

export function InventarioTransferencias() {
  return (
    <ModuloPestanas titulo="Inventario" descripcion="Bodegas y existencias por producto." tabs={TABS_INVENTARIO} permiso="inventario.ver">
      <TransferenciasInventarioPanel />
    </ModuloPestanas>
  );
}
