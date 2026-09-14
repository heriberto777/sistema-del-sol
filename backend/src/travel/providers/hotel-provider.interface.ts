import { CotizacionCancelacionVuelo, ResultadoCancelacionVuelo } from './travel-provider.interface';

/**
 * Contrato para un proveedor de HOTELES — hermano de TravelProvider
 * (vuelos), nunca el mismo: el dominio es distinto (accommodation/room/
 * rate vs. offer/order) y también lo es la liquidación (Hotelbeds no
 * tiene Balance prefondeado, factura neto por línea de crédito/
 * transferencia — confirmado contra el sandbox real: una reserva se crea
 * sin mandar ningún dato de pago). Reusa CotizacionCancelacionVuelo/
 * ResultadoCancelacionVuelo de travel-provider.interface — el shape ya es
 * genérico (id/montoReembolso/moneda) y así TravelService/el frontend
 * tratan la cancelación de un hotel igual que la de un vuelo.
 */

export interface OcupacionHotel {
  habitaciones: number;
  adultos: number;
  ninos: number;
}

export interface BuscarHotelesRequest {
  /** Código de destino de Hotelbeds (ej. "PMI") — Fase 1, sin geolocalización por coordenadas todavía. */
  destino: string;
  /** YYYY-MM-DD */
  checkIn: string;
  /** YYYY-MM-DD */
  checkOut: string;
  ocupacion: OcupacionHotel;
}

export interface TarifaHotel {
  /** Confirmado contra el sandbox real: hay que re-cotizar (confirmarTarifa) antes de reservar, nunca confiar en este precio cacheado. */
  rateKey: string;
  montoNeto: string;
  moneda: string;
  regimen: string;
  /** true si la política de cancelación tiene algún monto reembolsable antes del check-in. */
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

export interface TarifaConfirmadaHotel {
  /** El rateKey puede cambiar al re-cotizar — usar siempre este, no el de la búsqueda. */
  rateKey: string;
  montoNeto: string;
  moneda: string;
}

export interface HuespedReservaHotel {
  nombre: string;
  apellido: string;
  /** AD = adulto, CH = niño (confirmado contra el sandbox real). */
  tipo: 'AD' | 'CH';
}

export interface CrearReservaHotelRequest {
  rateKey: string;
  titular: { nombre: string; apellido: string };
  huespedes: HuespedReservaHotel[];
  /** Referencia propia (nuestro código interno) — Hotelbeds la guarda como clientReference. */
  referenciaCliente: string;
}

export interface ReservaHotelCreada {
  /** Referencia de Hotelbeds (ej. "1-8322356") — sirve como id de orden y como localizador, no hay uno separado. */
  referencia: string;
  montoTotal: string;
  moneda: string;
}

export interface HotelProvider {
  readonly clave: string;
  readonly habilitado: boolean;

  buscarHoteles(request: BuscarHotelesRequest): Promise<ResultadoBusquedaHoteles>;

  /** Re-cotiza (checkrates) — nunca confiar en el precio de la búsqueda al reservar. */
  confirmarTarifa(rateKey: string): Promise<TarifaConfirmadaHotel>;

  crearReserva(request: CrearReservaHotelRequest): Promise<ReservaHotelCreada>;

  /**
   * Paso 1 de 2 — simulación (confirmado contra el sandbox real:
   * `cancellationFlag=SIMULATION` no ejecuta nada, pero el `status` de la
   * respuesta igual dice "CANCELLED" — nunca leer ese campo para saber si
   * se ejecutó de verdad, solo usarlo para extraer el monto/moneda).
   */
  cotizarCancelacion(referenciaReserva: string): Promise<CotizacionCancelacionVuelo>;

  /**
   * Paso 2 de 2 — ejecuta la cancelación de verdad
   * (`cancellationFlag=CANCELLATION`), misma referencia de la reserva
   * original. `montoOriginal` es lo que YA se había debitado al ledger al
   * reservar (`TravelReserva.montoCosto`) — Hotelbeds no devuelve "cuánto
   * se reembolsa" como Duffel, devuelve `cancellationAmount` (la
   * PENALIDAD que sigue pendiente); el crédito real al ledger es
   * `montoOriginal - penalidad`, y solo el adapter tiene ambos números
   * para calcularlo bien.
   */
  confirmarCancelacion(referenciaReserva: string, montoOriginal: number): Promise<ResultadoCancelacionVuelo>;
}
