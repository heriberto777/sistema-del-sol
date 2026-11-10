import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { BalanceGeneralView } from '../../components/organisms/BalanceGeneralView/BalanceGeneralView';
import { TABS_CONTABILIDAD } from './tabs';

export function ContabilidadBalanceGeneral() {
  return (
    <ModuloPestanas
      titulo="Contabilidad"
      descripcion="Catálogo de cuentas, asientos y reportes financieros."
      tabs={TABS_CONTABILIDAD}
      permiso="contabilidad.ver"
    >
      <BalanceGeneralView />
    </ModuloPestanas>
  );
}
