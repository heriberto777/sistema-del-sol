export interface PasajeroTravel {
  id: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  email: string | null;
  telefono: string | null;
}

export interface TravelReserva {
  id: string;
  codigoInterno: string;
  clienteId: string;
  cliente: { id: string; nombre: string };
  tipo: 'VUELO' | 'HOTEL';
  estado: 'PENDIENTE' | 'CONFIRMADA' | 'FACTURADA' | 'CANCELADA';
  moneda: string;
  montoCosto: string;
  montoVenta: string;
  notas: string | null;
  facturaId: string | null;
  // Fase 1b — null en la carga manual (Fase 0), pobladas solo si se
  // reservó de verdad contra un proveedor (ver reservarOfertaVuelo).
  proveedor: string | null;
  proveedorOrdenId: string | null;
  localizadorAerolinea: string | null;
  proveedorCancelacionId: string | null;
  // Alerta del webhook de Duffel (cambio de itinerario/cancelación externa) — null = sin alerta pendiente.
  alertaProveedorTipo: string | null;
  alertaProveedorDetalle: string | null;
  alertaProveedorEn: string | null;
  pasajeros: PasajeroTravel[];
  createdAt: string;
  updatedAt: string;
}

/// Segmento real de un tramo de vuelo — forma confirmada contra el
/// sandbox real de Duffel (no inventada). `passenger_id` es el mismo id
/// que hay que mandar en `pasajeros[].id` al reservar.
export interface SegmentoVueloCrudo {
  id: string;
  departing_at: string;
  arriving_at: string;
  marketing_carrier_flight_number: string;
  marketing_carrier: { name: string; iata_code: string; logo_symbol_url: string | null };
  origin: { iata_code: string; city_name: string | null };
  destination: { iata_code: string; city_name: string | null };
  passengers: { passenger_id: string }[];
}

export interface TramoVueloCrudo {
  id: string;
  /** Duración ISO 8601 (ej. "PT9H30M") — ver formatoDuracionIso en TravelBuscarVuelo. */
  duration: string;
  origin: { iata_code: string; city_name: string | null };
  destination: { iata_code: string; city_name: string | null };
  segments: SegmentoVueloCrudo[];
}

export interface OfertaVuelo {
  id: string;
  aerolinea: string;
  montoTotal: string;
  moneda: string;
  expiraEn: string;
  tramosCrudo: TramoVueloCrudo[];
}

export interface ResultadoBusquedaVuelos {
  solicitudId: string;
  ofertas: OfertaVuelo[];
}

export interface TravelReglaMarkup {
  id: string;
  tipo: 'VUELO' | 'HOTEL' | null;
  porcentaje: string | null;
  montoFijo: string | null;
  activa: boolean;
  createdAt: string;
}

export const TIPOS_TRAVEL_RESERVA = ['VUELO', 'HOTEL'] as const;
export const ETIQUETA_TIPO_TRAVEL_RESERVA: Record<string, string> = { VUELO: 'Vuelo', HOTEL: 'Hotel' };

export const ESTADOS_TRAVEL_RESERVA = ['PENDIENTE', 'CONFIRMADA', 'FACTURADA', 'CANCELADA'] as const;
export const ETIQUETA_ESTADO_TRAVEL_RESERVA: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  FACTURADA: 'Facturada',
  CANCELADA: 'Cancelada',
};
export const COLOR_ESTADO_TRAVEL_RESERVA: Record<string, string> = {
  PENDIENTE: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  CONFIRMADA: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  FACTURADA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  CANCELADA: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};
