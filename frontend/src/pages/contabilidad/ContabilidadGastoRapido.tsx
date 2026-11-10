import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { GastoRapidoForm } from '../../components/organisms/GastoRapidoForm/GastoRapidoForm';

export function ContabilidadGastoRapido() {
  return (
    <ModuloPestanas titulo="Gasto rápido" descripcion="Registrá un gasto de 2 líneas sin armar un asiento completo." permiso="contabilidad.editar">
      <GastoRapidoForm />
    </ModuloPestanas>
  );
}
