import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { GastoRapidoForm } from '../../components/organisms/GastoRapidoForm/GastoRapidoForm';
import { TABS_CONTABILIDAD } from './tabs';

export function ContabilidadGastoRapido() {
  return (
    <ModuloPestanas
      titulo="Contabilidad"
      descripcion="Catálogo de cuentas, asientos y reportes financieros."
      tabs={TABS_CONTABILIDAD}
      permiso="contabilidad.editar"
    >
      <GastoRapidoForm />
    </ModuloPestanas>
  );
}
