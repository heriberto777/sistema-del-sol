import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { CuentasContablesTable } from '../../components/organisms/CuentasContablesTable/CuentasContablesTable';
import { TABS_CONTABILIDAD } from './tabs';

export function ContabilidadCuentas() {
  return (
    <ModuloPestanas
      titulo="Contabilidad"
      descripcion="Catálogo de cuentas, asientos y reportes financieros."
      tabs={TABS_CONTABILIDAD}
      permiso="contabilidad.ver"
    >
      <CuentasContablesTable />
    </ModuloPestanas>
  );
}
