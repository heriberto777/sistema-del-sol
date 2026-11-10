import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { ReporteVentasAgrupado } from '../../components/organisms/ReporteVentasAgrupado/ReporteVentasAgrupado';

export function ReportesVentasAgrupadas() {
  return (
    <ModuloPestanas titulo="Ventas agrupadas" descripcion="Ventas agrupadas por cliente, producto o vendedor." permiso="reportes.ver">
      <ReporteVentasAgrupado />
    </ModuloPestanas>
  );
}
