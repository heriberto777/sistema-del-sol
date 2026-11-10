import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { AsientosContablesTable } from '../../components/organisms/AsientosContablesTable/AsientosContablesTable';

export function ContabilidadAsientos() {
  return (
    <ModuloPestanas titulo="Historial de asientos" descripcion="Movimientos contables registrados, de partida doble." permiso="contabilidad.ver">
      <AsientosContablesTable />
    </ModuloPestanas>
  );
}
