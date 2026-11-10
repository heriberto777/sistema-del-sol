import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { SeccionesTiendaPanel } from '../../components/organisms/SeccionesTiendaPanel/SeccionesTiendaPanel';
import { TABS_TIENDA_ONLINE } from './tabs';

export function TiendaOnlineSecciones() {
  return (
    <ModuloPestanas
      titulo="Tienda Online"
      descripcion="Configurá el storefront público de tu catálogo y revisá los pedidos."
      tabs={TABS_TIENDA_ONLINE}
      permiso="ecommerce.ver"
    >
      <SeccionesTiendaPanel />
    </ModuloPestanas>
  );
}
