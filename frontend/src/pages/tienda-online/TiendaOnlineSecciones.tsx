import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { SeccionesTiendaPanel } from '../../components/organisms/SeccionesTiendaPanel/SeccionesTiendaPanel';

export function TiendaOnlineSecciones() {
  return (
    <ModuloPestanas titulo="Secciones del Home" descripcion="Organizá qué se muestra y en qué orden en la portada de tu tienda." permiso="ecommerce.ver">
      <SeccionesTiendaPanel />
    </ModuloPestanas>
  );
}
