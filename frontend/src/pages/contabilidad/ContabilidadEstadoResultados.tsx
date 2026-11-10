import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { EstadoResultadosView } from '../../components/organisms/EstadoResultadosView/EstadoResultadosView';
import { TABS_CONTABILIDAD } from './tabs';

export function ContabilidadEstadoResultados() {
  return (
    <ModuloPestanas
      titulo="Contabilidad"
      descripcion="Catálogo de cuentas, asientos y reportes financieros."
      tabs={TABS_CONTABILIDAD}
      permiso="contabilidad.ver"
    >
      <EstadoResultadosView />
    </ModuloPestanas>
  );
}
