import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { SaldoLedgerTravel } from '../../components/molecules/SaldoLedgerTravel/SaldoLedgerTravel';
import { TravelMarkupPanel } from '../../components/organisms/TravelMarkupPanel/TravelMarkupPanel';
import { TABS_TRAVEL } from './tabs';

export function TravelMarkup() {
  return (
    <ModuloPestanas
      titulo="Travel Management"
      descripcion="Búsqueda y reserva real de vuelos (Duffel) + carga manual."
      tabs={TABS_TRAVEL}
      permiso="travel.ver"
    >
      <div className="space-y-4">
        <SaldoLedgerTravel />
        <TravelMarkupPanel />
      </div>
    </ModuloPestanas>
  );
}
