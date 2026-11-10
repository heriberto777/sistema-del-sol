import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { ConciliacionBancariaView } from '../../components/organisms/ConciliacionBancariaView/ConciliacionBancariaView';
import { TABS_CONTABILIDAD } from './tabs';

/**
 * Antes vivía en /bancos (bug real de ruteo, ver docs/ARCHITECTURE.md) — el
 * menú prometía "Conciliación bancaria" y abría el CRUD de cuentas
 * bancarias en vez de esta vista, porque ambas rutas apuntaban a páginas
 * distintas que nunca coincidían con la pestaña activa.
 */
export function ContabilidadConciliacion() {
  return (
    <ModuloPestanas
      titulo="Contabilidad"
      descripcion="Catálogo de cuentas, asientos y reportes financieros."
      tabs={TABS_CONTABILIDAD}
      permiso="contabilidad.conciliar"
    >
      <ConciliacionBancariaView />
    </ModuloPestanas>
  );
}
