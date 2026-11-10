import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { SaldoLedgerTravel } from '../../components/molecules/SaldoLedgerTravel/SaldoLedgerTravel';
import { TravelReservasPanel } from '../../components/organisms/TravelReservasPanel/TravelReservasPanel';

export function TravelReservasLista() {
  return (
    <ModuloPestanas titulo="Mis reservas" descripcion="Reservas de vuelos y hoteles, real y cargadas a mano." permiso="travel.ver">
      <div className="space-y-4">
        <SaldoLedgerTravel />
        <TravelReservasPanel />
      </div>
    </ModuloPestanas>
  );
}
