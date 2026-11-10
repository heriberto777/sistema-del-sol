import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { SaldoLedgerTravel } from '../../components/molecules/SaldoLedgerTravel/SaldoLedgerTravel';
import { TravelReservasPanel } from '../../components/organisms/TravelReservasPanel/TravelReservasPanel';
import { TABS_TRAVEL } from './tabs';

export function TravelReservasLista() {
  return (
    <ModuloPestanas
      titulo="Travel Management"
      descripcion="Búsqueda y reserva real de vuelos (Duffel) + carga manual."
      tabs={TABS_TRAVEL}
      permiso="travel.ver"
    >
      <div className="space-y-4">
        <SaldoLedgerTravel />
        <TravelReservasPanel />
      </div>
    </ModuloPestanas>
  );
}
