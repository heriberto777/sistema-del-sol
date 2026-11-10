import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { TransferenciasInventarioPanel } from '../../components/organisms/TransferenciasInventarioPanel/TransferenciasInventarioPanel';

export function InventarioTransferencias() {
  return (
    <ModuloPestanas titulo="Historial de transferencias" descripcion="Transferencias de inventario entre bodegas." permiso="inventario.ver">
      <TransferenciasInventarioPanel />
    </ModuloPestanas>
  );
}
