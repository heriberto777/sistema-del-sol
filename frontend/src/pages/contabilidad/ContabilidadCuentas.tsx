import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { CuentasContablesTable } from '../../components/organisms/CuentasContablesTable/CuentasContablesTable';

export function ContabilidadCuentas() {
  return (
    <ModuloPestanas titulo="Catálogo de cuentas" descripcion="Plan de cuentas contables de tu empresa." permiso="contabilidad.ver">
      <CuentasContablesTable />
    </ModuloPestanas>
  );
}
