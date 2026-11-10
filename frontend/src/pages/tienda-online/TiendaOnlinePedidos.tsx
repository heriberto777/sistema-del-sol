import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { PedidosTiendaPanel } from '../../components/organisms/PedidosTiendaPanel/PedidosTiendaPanel';

export function TiendaOnlinePedidos() {
  return (
    <ModuloPestanas titulo="Gestionar pedidos" descripcion="Pedidos recibidos a través de tu tienda online." permiso="ecommerce.ver">
      <PedidosTiendaPanel />
    </ModuloPestanas>
  );
}
