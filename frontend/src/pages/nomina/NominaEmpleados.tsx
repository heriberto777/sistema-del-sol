import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { EmpleadosTable } from '../../components/organisms/EmpleadosTable/EmpleadosTable';
import { TABS_NOMINA } from './tabs';

export function NominaEmpleados() {
  return (
    <ModuloPestanas titulo="Nómina" descripcion="Empleados, períodos y recibos de pago." tabs={TABS_NOMINA} permiso="nomina.ver">
      <EmpleadosTable />
    </ModuloPestanas>
  );
}
