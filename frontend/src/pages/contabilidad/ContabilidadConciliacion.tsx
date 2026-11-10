import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { ConciliacionBancariaView } from '../../components/organisms/ConciliacionBancariaView/ConciliacionBancariaView';

/**
 * Antes vivía en /bancos (bug real de ruteo, ver docs/ARCHITECTURE.md) — el
 * menú prometía "Conciliación bancaria" y abría el CRUD de cuentas
 * bancarias en vez de esta vista, porque ambas rutas apuntaban a páginas
 * distintas que nunca coincidían con la pestaña activa.
 */
export function ContabilidadConciliacion() {
  return (
    <ModuloPestanas titulo="Conciliación bancaria" descripcion="Cruzá tus movimientos contables contra el estado de cuenta del banco." permiso="contabilidad.conciliar">
      <ConciliacionBancariaView />
    </ModuloPestanas>
  );
}
