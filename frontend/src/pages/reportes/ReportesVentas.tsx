import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { ReporteVentas } from '../../components/organisms/ReporteVentas/ReporteVentas';

export function ReportesVentas() {
  return (
    <ModuloPestanas titulo="Ventas" descripcion="Qué y cuánto vendiste en el período." permiso="reportes.ver">
      <ReporteVentas />
    </ModuloPestanas>
  );
}
