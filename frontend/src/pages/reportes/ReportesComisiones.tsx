import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { ReporteComisiones } from '../../components/organisms/ReporteComisiones/ReporteComisiones';
import { TABS_REPORTES_VENTAS } from './tabs-ventas';

export function ReportesComisiones() {
  return (
    <ModuloPestanas titulo="Reportes de Ventas" descripcion="Ventas, rentabilidad y comisiones." tabs={TABS_REPORTES_VENTAS} permiso="comisiones.ver">
      <ReporteComisiones />
    </ModuloPestanas>
  );
}
