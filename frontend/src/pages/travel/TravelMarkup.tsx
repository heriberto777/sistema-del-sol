import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { SaldoLedgerTravel } from '../../components/molecules/SaldoLedgerTravel/SaldoLedgerTravel';
import { TravelMarkupPanel } from '../../components/organisms/TravelMarkupPanel/TravelMarkupPanel';

export function TravelMarkup() {
  return (
    <ModuloPestanas titulo="Reglas de markup" descripcion="Porcentaje de ganancia que aplicás sobre el costo de vuelos y hoteles." permiso="travel.ver">
      <div className="space-y-4">
        <SaldoLedgerTravel />
        <TravelMarkupPanel />
      </div>
    </ModuloPestanas>
  );
}
