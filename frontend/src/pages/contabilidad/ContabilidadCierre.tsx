import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { CierrePeriodoView } from '../../components/organisms/CierrePeriodoView/CierrePeriodoView';
import { TABS_CONTABILIDAD } from './tabs';

export function ContabilidadCierre() {
  return (
    <ModuloPestanas
      titulo="Contabilidad"
      descripcion="Catálogo de cuentas, asientos y reportes financieros."
      tabs={TABS_CONTABILIDAD}
      permiso="contabilidad.cerrarperiodo"
    >
      <CierrePeriodoView />
    </ModuloPestanas>
  );
}
