import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { PeriodosNominaTable } from '../../components/organisms/PeriodosNominaTable/PeriodosNominaTable';
import { TABS_NOMINA } from './tabs';

export function NominaPeriodos() {
  return (
    <ModuloPestanas titulo="Nómina" descripcion="Empleados, períodos y recibos de pago." tabs={TABS_NOMINA} permiso="nomina.ver">
      <PeriodosNominaTable />
    </ModuloPestanas>
  );
}
