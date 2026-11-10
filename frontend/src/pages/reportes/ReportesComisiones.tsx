import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { ReporteComisiones } from '../../components/organisms/ReporteComisiones/ReporteComisiones';

export function ReportesComisiones() {
  return (
    <ModuloPestanas titulo="Comisiones" descripcion="Comisión de venta por vendedor, calculada automáticamente por línea de factura." permiso="comisiones.ver">
      <ReporteComisiones />
    </ModuloPestanas>
  );
}
