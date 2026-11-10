import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { ReporteRentabilidad } from '../../components/organisms/ReporteRentabilidad/ReporteRentabilidad';
import { TABS_REPORTES_VENTAS } from './tabs-ventas';

export function ReportesRentabilidad() {
  return (
    <ModuloPestanas titulo="Reportes de Ventas" descripcion="Ventas, rentabilidad y comisiones." tabs={TABS_REPORTES_VENTAS} permiso="reportes.ver">
      <ReporteRentabilidad />
    </ModuloPestanas>
  );
}
