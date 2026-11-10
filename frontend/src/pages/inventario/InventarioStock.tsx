import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { StockBodegasPanel } from '../../components/organisms/StockBodegasPanel/StockBodegasPanel';
import { TABS_INVENTARIO } from './tabs';

export function InventarioStock() {
  return (
    <ModuloPestanas titulo="Inventario" descripcion="Bodegas y existencias por producto." tabs={TABS_INVENTARIO} permiso="inventario.ver">
      <StockBodegasPanel />
    </ModuloPestanas>
  );
}
