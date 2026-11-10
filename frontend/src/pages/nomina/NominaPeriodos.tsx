import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { PeriodosNominaTable } from '../../components/organisms/PeriodosNominaTable/PeriodosNominaTable';

export function NominaPeriodos() {
  return (
    <ModuloPestanas titulo="Períodos de nómina" descripcion="Procesá y consultá el historial de períodos de nómina." permiso="nomina.ver">
      <PeriodosNominaTable />
    </ModuloPestanas>
  );
}
