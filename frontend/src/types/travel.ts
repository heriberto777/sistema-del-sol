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

/** Equipaje incluido para un pasajero en un segmento — esquema documentado de Duffel, TODAVÍA NO confirmado contra el sandbox real (a diferencia del resto de esta interfaz) — campos opcionales a propósito, si el nombre real difiere simplemente no se muestra nada, nunca rompe. */
export interface EquipajeSegmentoVuelo {
  type: 'checked' | 'carry_on';
  quantity: number;
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
  /** Aerolínea que opera el vuelo de verdad (vuelo code-share) — ausente o igual a marketing_carrier cuando no aplica. NO confirmado contra el sandbox real todavía. */
  operating_carrier?: { name: string; iata_code: string } | null;
  origin: { iata_code: string; city_name: string | null };
  destination: { iata_code: string; city_name: string | null };
  passengers: {
    passenger_id: string;
    /** Nombre comercial de la tarifa que usa la aerolínea (ej. "Economy Light") — NO confirmado contra el sandbox real todavía. */
    cabin_class_marketing_name?: string | null;
    /** NO confirmado contra el sandbox real todavía. */
    baggages?: EquipajeSegmentoVuelo[];
  }[];
}

export interface TramoVueloCrudo {
  id: string;
  /** Duración ISO 8601 (ej. "PT9H30M") — ver formatoDuracionIso en TravelBuscarVuelo. */
  duration: string;
  origin: { iata_code: string; city_name: string | null };
  destination: { iata_code: string; city_name: string | null };
  segments: SegmentoVueloCrudo[];
}

/// Pasajero de la oferta con el tipo ya resuelto por la aerolínea (edad 8
/// -> "child", edad 1 -> "infant_without_seat") — confirmado contra el
/// sandbox real, no hay que adivinarlo por los segmentos.
export interface PasajeroOfertaVuelo {
  id: string;
  tipo: 'adult' | 'child' | 'infant_without_seat';
  edad: number | null;
}

export interface OfertaVuelo {
  id: string;
  aerolinea: string;
  montoTotal: string;
  moneda: string;
  expiraEn: string;
  tramosCrudo: TramoVueloCrudo[];
  pasajeros: PasajeroOfertaVuelo[];
}

export interface ResultadoBusquedaVuelos {
  solicitudId: string;
  ofertas: OfertaVuelo[];
}

export interface TarifaHotel {
  rateKey: string;
  montoNeto: string;
  moneda: string;
  regimen: string;
  reembolsable: boolean;
}

export interface HabitacionHotel {
  codigo: string;
  nombre: string;
  tarifas: TarifaHotel[];
}

export interface HotelListado {
  codigo: number;
  nombre: string;
  categoria: string;
  destino: string;
  habitaciones: HabitacionHotel[];
}

export interface ResultadoBusquedaHoteles {
  hoteles: HotelListado[];
}

export interface DestinoHotel {
  codigo: string;
  nombre: string;
  pais: string;
  bandera: string;
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
