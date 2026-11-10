import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { EstadoResultadosView } from '../../components/organisms/EstadoResultadosView/EstadoResultadosView';

export function ContabilidadEstadoResultados() {
  return (
    <ModuloPestanas titulo="Estado de resultados" descripcion="Ingresos, costos y gastos del período — tu ganancia o pérdida." permiso="contabilidad.ver">
      <EstadoResultadosView />
    </ModuloPestanas>
  );
}
