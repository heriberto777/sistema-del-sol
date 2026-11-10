import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { RetencionesNominaView } from '../../components/organisms/RetencionesNominaView/RetencionesNominaView';

export function NominaRetenciones() {
  return (
    <ModuloPestanas titulo="Retenciones de ISR" descripcion="Retenciones de ISR de los períodos de nómina ya procesados." permiso="nomina.ver">
      <RetencionesNominaView />
    </ModuloPestanas>
  );
}
