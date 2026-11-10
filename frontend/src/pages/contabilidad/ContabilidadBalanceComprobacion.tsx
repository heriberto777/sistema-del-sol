import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { BalanceComprobacionView } from '../../components/organisms/BalanceComprobacionView/BalanceComprobacionView';

export function ContabilidadBalanceComprobacion() {
  return (
    <ModuloPestanas titulo="Balance de comprobación" descripcion="Saldo acumulado y movimientos de cada cuenta contable." permiso="contabilidad.ver">
      <BalanceComprobacionView />
    </ModuloPestanas>
  );
}
