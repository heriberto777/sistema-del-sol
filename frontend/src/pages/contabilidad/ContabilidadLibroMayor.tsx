import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { LibroMayorView } from '../../components/organisms/LibroMayorView/LibroMayorView';
import { TABS_CONTABILIDAD } from './tabs';

export function ContabilidadLibroMayor() {
  return (
    <ModuloPestanas
      titulo="Contabilidad"
      descripcion="Catálogo de cuentas, asientos y reportes financieros."
      tabs={TABS_CONTABILIDAD}
      permiso="contabilidad.ver"
    >
      <LibroMayorView />
    </ModuloPestanas>
  );
}
