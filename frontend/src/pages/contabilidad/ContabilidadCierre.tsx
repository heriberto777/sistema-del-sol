import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { CierrePeriodoView } from '../../components/organisms/CierrePeriodoView/CierrePeriodoView';

export function ContabilidadCierre() {
  return (
    <ModuloPestanas titulo="Cierre de período" descripcion="Cerrá un período contable para dejarlo firme." permiso="contabilidad.cerrarperiodo">
      <CierrePeriodoView />
    </ModuloPestanas>
  );
}
