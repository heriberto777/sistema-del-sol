import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { FiscalDgiiView } from '../../components/organisms/FiscalDgiiView/FiscalDgiiView';

export function ContabilidadFiscal() {
  return (
    <ModuloPestanas titulo="Fiscal DGII" descripcion="Reportes fiscales para tus obligaciones ante la DGII (606/607/608, IT-1)." permiso="contabilidad.ver">
      <FiscalDgiiView />
    </ModuloPestanas>
  );
}
