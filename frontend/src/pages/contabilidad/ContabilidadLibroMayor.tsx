import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { LibroMayorView } from '../../components/organisms/LibroMayorView/LibroMayorView';

export function ContabilidadLibroMayor() {
  return (
    <ModuloPestanas titulo="Libro diario / mayor" descripcion="Movimientos contables detallados por cuenta, en orden cronológico." permiso="contabilidad.ver">
      <LibroMayorView />
    </ModuloPestanas>
  );
}
