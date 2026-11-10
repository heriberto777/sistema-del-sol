import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { SaldoLedgerTravel } from '../../components/molecules/SaldoLedgerTravel/SaldoLedgerTravel';
import { TravelBuscarHotelPanel } from '../../components/organisms/TravelBuscarHotelPanel/TravelBuscarHotelPanel';

export function TravelBuscarHotel() {
  return (
    <ModuloPestanas titulo="Buscar y reservar hotel" descripcion="Búsqueda y reserva real de hoteles vía Hotelbeds." permiso="travel.ver">
      <div className="space-y-4">
        <SaldoLedgerTravel />
        <TravelBuscarHotelPanel />
      </div>
    </ModuloPestanas>
  );
}
