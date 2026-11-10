import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { BalanceGeneralView } from '../../components/organisms/BalanceGeneralView/BalanceGeneralView';

export function ContabilidadBalanceGeneral() {
  return (
    <ModuloPestanas titulo="Balance general" descripcion="Activos, pasivos y patrimonio de tu empresa a la fecha." permiso="contabilidad.ver">
      <BalanceGeneralView />
    </ModuloPestanas>
  );
}
