/**
 * Contrato único para cualquier proveedor de vuelos — la aplicación
 * (TravelService, controllers) nunca conoce si detrás hay Duffel,
 * Amadeus o Travelport (ver TravelProviderService). Mismo rol que
 * PasarelaPagoAdapter para pagos o EmisorECfAdapter para e-CF: una
 * interfaz mínima con `clave`/`habilitado` + los métodos de negocio.
 *
 * Las formas de acá son NORMALIZADAS (no el JSON crudo de Duffel) a
 * propósito — si mañana se agrega Amadeus, tiene que poder devolver
 * exactamente estas mismas formas sin que el resto del sistema note la
 * diferencia.
 */

export interface PasajeroBusquedaVuelo {
  tipo: 'adult' | 'child' | 'infant_without_seat';
}

export interface TramoBusquedaVuelo {
  /** Código IATA de 3 letras (ej. "SDQ"). */
  origen: string;
  destino: string;
  /** YYYY-MM-DD */
  fecha: string;
}

export interface BuscarVuelosRequest {
  tramos: TramoBusquedaVuelo[];
  pasajeros: PasajeroBusquedaVuelo[];
  cabina?: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface OfertaVuelo {
  /** Id de la oferta en el proveedor — se re-consulta con obtenerOferta() antes de reservar, nunca se confía en el monto cacheado. */
  id: string;
  aerolinea: string;
  montoTotal: string;
  moneda: string;
  /** ISO 8601 — pasado este momento, la oferta ya no se puede reservar (hay que rehacer la búsqueda). */
  expiraEn: string;
  /** JSON crudo de los tramos/segmentos del proveedor — sin normalizar todavía (Fase 2, cuando exista una UI que los necesite en detalle). */
  tramosCrudo: unknown;
}

export interface ResultadoBusquedaVuelos {
  /** Id de la búsqueda en el proveedor (ej. el "offer request" de Duffel) — sin uso propio todavía, se guarda para trazabilidad. */
  solicitudId: string;
  ofertas: OfertaVuelo[];
}

export interface PasajeroOrdenVuelo {
  /** Debe coincidir con un id de pasajero devuelto por la oferta (Duffel los pide así para asociar cada asiento). */
  id: string;
  nombre: string;
  apellido: string;
  /** YYYY-MM-DD */
  fechaNacimiento: string;
  genero: 'm' | 'f';
  /** Duffel lo exige siempre (confirmado contra el sandbox real, la doc oficial no lo dejaba claro): 'mr' | 'mrs' | 'ms' | 'miss' | 'dr'. */
  titulo: string;
  email: string;
  telefono: string;
  /**
   * Pasaporte (APIS) — opcional a propósito: no toda ruta/aerolínea lo
   * exige, pero Duffel lo acepta sin error cuando se manda (confirmado
   * contra el sandbox real). Si se completa uno, hay que completar los 3.
   */
  numeroPasaporte?: string;
  /** ISO 3166-1 alpha-2 (ej. "DO"). */
  paisEmisionPasaporte?: string;
  /** YYYY-MM-DD */
  fechaVencimientoPasaporte?: string;
}

export interface CrearOrdenVueloRequest {
  ofertaId: string;
  pasajeros: PasajeroOrdenVuelo[];
  /** Pago vía Balance (billetera prefondeada de la agencia) — nunca tarjeta, ver "Los Dos Pagos del Vuelo": con tarjeta no se puede aplicar markup. */
  montoBalance: number;
  monedaBalance: string;
}

export interface OrdenVuelo {
  /** Id de la orden en el proveedor. */
  id: string;
  /** Localizador de la aerolínea (lo que el pasajero usa en el mostrador/check-in). */
  localizador: string;
  montoTotal: string;
  moneda: string;
}

export interface CotizacionCancelacionVuelo {
  /** Id de la cancelación en el proveedor — se pasa a confirmarCancelacion(). */
  id: string;
  /** null = el proveedor todavía no puede cotizar el reembolso (tarifa que requiere intervención manual de la aerolínea). */
  montoReembolso: string | null;
  moneda: string | null;
}

export interface ResultadoCancelacionVuelo {
  reembolsado: boolean;
  montoReembolso: string | null;
  moneda: string | null;
}

export interface TravelProvider {
  readonly clave: string;
  readonly habilitado: boolean;

  buscarVuelos(request: BuscarVuelosRequest): Promise<ResultadoBusquedaVuelos>;

  /** Re-consulta la oferta para revalidar precio/disponibilidad antes de reservar — nunca confiar en una oferta cacheada sin este paso (ver §12 del doc original). */
  obtenerOferta(ofertaId: string): Promise<OfertaVuelo>;

  crearOrdenVuelo(request: CrearOrdenVueloRequest): Promise<OrdenVuelo>;

  /** Paso 1 de 2 — cotiza el reembolso sin ejecutar la cancelación todavía. */
  cotizarCancelacion(ordenId: string): Promise<CotizacionCancelacionVuelo>;

  /** Paso 2 de 2 — confirma la cancelación cotizada por cotizarCancelacion(). */
  confirmarCancelacion(cancelacionId: string): Promise<ResultadoCancelacionVuelo>;
}
