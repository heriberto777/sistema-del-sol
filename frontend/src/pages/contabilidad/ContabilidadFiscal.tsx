import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { FiscalDgiiView } from '../../components/organisms/FiscalDgiiView/FiscalDgiiView';
import { TABS_CONTABILIDAD } from './tabs';

export function ContabilidadFiscal() {
  return (
    <ModuloPestanas
      titulo="Contabilidad"
      descripcion="Catálogo de cuentas, asientos y reportes financieros."
      tabs={TABS_CONTABILIDAD}
      permiso="contabilidad.ver"
    >
      <FiscalDgiiView />
    </ModuloPestanas>
  );
}
