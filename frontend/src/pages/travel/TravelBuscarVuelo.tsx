import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { SaldoLedgerTravel } from '../../components/molecules/SaldoLedgerTravel/SaldoLedgerTravel';
import { TravelBuscarVueloPanel } from '../../components/organisms/TravelBuscarVueloPanel/TravelBuscarVueloPanel';

export function TravelBuscarVuelo() {
  return (
    <ModuloPestanas titulo="Buscar y reservar vuelo" descripcion="Búsqueda y reserva real de vuelos vía Duffel." permiso="travel.ver">
      <div className="space-y-4">
        <SaldoLedgerTravel />
        <TravelBuscarVueloPanel />
      </div>
    </ModuloPestanas>
  );
}
