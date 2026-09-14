import { Injectable } from '@nestjs/common';
import { HotelbedsAdapter } from './hotelbeds.adapter';
import { HotelProvider } from './hotel-provider.interface';

/** Mismo patrón que TravelProviderService (vuelos) — hoy solo Hotelbeds. */
@Injectable()
export class HotelProviderService {
  constructor(private readonly hotelbedsAdapter: HotelbedsAdapter) {}

  get activo(): HotelProvider {
    const clave = process.env.HOTEL_PROVIDER_ACTIVO || 'hotelbeds';
    const adaptadores: Record<string, HotelProvider> = {
      hotelbeds: this.hotelbedsAdapter,
    };
    return adaptadores[clave] ?? this.hotelbedsAdapter;
  }
}
