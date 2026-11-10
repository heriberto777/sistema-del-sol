import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { PedidosTiendaPanel } from '../../components/organisms/PedidosTiendaPanel/PedidosTiendaPanel';
import { TABS_TIENDA_ONLINE } from './tabs';

export function TiendaOnlinePedidos() {
  return (
    <ModuloPestanas
      titulo="Tienda Online"
      descripcion="Configurá el storefront público de tu catálogo y revisá los pedidos."
      tabs={TABS_TIENDA_ONLINE}
      permiso="ecommerce.ver"
    >
      <PedidosTiendaPanel />
    </ModuloPestanas>
  );
}
