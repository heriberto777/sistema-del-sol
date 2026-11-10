import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { ReporteVentas } from '../../components/organisms/ReporteVentas/ReporteVentas';
import { TABS_REPORTES_VENTAS } from './tabs-ventas';

export function ReportesVentas() {
  return (
    <ModuloPestanas titulo="Reportes de Ventas" descripcion="Ventas, rentabilidad y comisiones." tabs={TABS_REPORTES_VENTAS} permiso="reportes.ver">
      <ReporteVentas />
    </ModuloPestanas>
  );
}
