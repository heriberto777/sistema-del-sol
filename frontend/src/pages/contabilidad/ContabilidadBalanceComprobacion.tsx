import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { BalanceComprobacionView } from '../../components/organisms/BalanceComprobacionView/BalanceComprobacionView';
import { TABS_CONTABILIDAD } from './tabs';

export function ContabilidadBalanceComprobacion() {
  return (
    <ModuloPestanas
      titulo="Contabilidad"
      descripcion="Catálogo de cuentas, asientos y reportes financieros."
      tabs={TABS_CONTABILIDAD}
      permiso="contabilidad.ver"
    >
      <BalanceComprobacionView />
    </ModuloPestanas>
  );
}
