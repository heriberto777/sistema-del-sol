import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { ReporteRentabilidad } from '../../components/organisms/ReporteRentabilidad/ReporteRentabilidad';

export function ReportesRentabilidad() {
  return (
    <ModuloPestanas titulo="Rentabilidad" descripcion="Margen de ganancia por venta, producto o período." permiso="reportes.ver">
      <ReporteRentabilidad />
    </ModuloPestanas>
  );
}
