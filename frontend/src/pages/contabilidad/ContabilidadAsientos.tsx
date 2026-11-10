import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { AsientosContablesTable } from '../../components/organisms/AsientosContablesTable/AsientosContablesTable';
import { TABS_CONTABILIDAD } from './tabs';

export function ContabilidadAsientos() {
  return (
    <ModuloPestanas
      titulo="Contabilidad"
      descripcion="Catálogo de cuentas, asientos y reportes financieros."
      tabs={TABS_CONTABILIDAD}
      permiso="contabilidad.ver"
    >
      <AsientosContablesTable />
    </ModuloPestanas>
  );
}
