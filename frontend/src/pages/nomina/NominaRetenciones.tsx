import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { RetencionesNominaView } from '../../components/organisms/RetencionesNominaView/RetencionesNominaView';
import { TABS_NOMINA } from './tabs';

export function NominaRetenciones() {
  return (
    <ModuloPestanas titulo="Nómina" descripcion="Empleados, períodos y recibos de pago." tabs={TABS_NOMINA} permiso="nomina.ver">
      <RetencionesNominaView />
    </ModuloPestanas>
  );
}
