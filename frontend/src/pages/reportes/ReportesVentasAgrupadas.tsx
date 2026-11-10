import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { ReporteVentasAgrupado } from '../../components/organisms/ReporteVentasAgrupado/ReporteVentasAgrupado';
import { TABS_REPORTES_VENTAS } from './tabs-ventas';

export function ReportesVentasAgrupadas() {
  return (
    <ModuloPestanas titulo="Reportes de Ventas" descripcion="Ventas, rentabilidad y comisiones." tabs={TABS_REPORTES_VENTAS} permiso="reportes.ver">
      <ReporteVentasAgrupado />
    </ModuloPestanas>
  );
}
