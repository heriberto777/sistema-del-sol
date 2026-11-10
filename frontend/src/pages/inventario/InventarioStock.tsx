import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { StockBodegasPanel } from '../../components/organisms/StockBodegasPanel/StockBodegasPanel';

export function InventarioStock() {
  return (
    <ModuloPestanas titulo="Stock actual" descripcion="Existencias por bodega y producto." permiso="inventario.ver">
      <StockBodegasPanel />
    </ModuloPestanas>
  );
}
