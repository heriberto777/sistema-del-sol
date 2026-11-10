import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { SaldoLedgerTravel } from '../../components/molecules/SaldoLedgerTravel/SaldoLedgerTravel';
import { TravelResumenPanel } from '../../components/organisms/TravelResumenPanel/TravelResumenPanel';

export function TravelResumen() {
  return (
    <ModuloPestanas titulo="Resumen de Travel" descripcion="Saldo y actividad reciente de reservas de vuelos y hoteles." permiso="travel.ver">
      <div className="space-y-4">
        <SaldoLedgerTravel />
        <TravelResumenPanel />
      </div>
    </ModuloPestanas>
  );
}
