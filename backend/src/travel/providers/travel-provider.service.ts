import { Injectable } from '@nestjs/common';
import { DuffelAdapter } from './duffel.adapter';
import { TravelProvider } from './travel-provider.interface';

/**
 * Único punto que sabe qué proveedor de vuelos está activo
 * (TRAVEL_PROVIDER_ACTIVO) — mismo patrón que PasarelaPagoService. Hoy
 * solo existe DuffelAdapter real; Amadeus/Travelport entran acá el día
 * que se implementen, sin tocar nada que ya use TravelProvider.
 */
@Injectable()
export class TravelProviderService {
  constructor(private readonly duffelAdapter: DuffelAdapter) {}

  get activo(): TravelProvider {
    const clave = process.env.TRAVEL_PROVIDER_ACTIVO || 'duffel';
    const adaptadores: Record<string, TravelProvider> = {
      duffel: this.duffelAdapter,
    };
    return adaptadores[clave] ?? this.duffelAdapter;
  }
}
