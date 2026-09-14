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
  /** Uno u otro, nunca ambos (Duffel los trata como mutuamente excluyentes) — si vienen los dos, la edad gana. */
  tipo?: 'adult' | 'child' | 'infant_without_seat';
  edad?: number;
}

/**
 * Pasajero tal como lo devuelve la oferta/re-price de Duffel — `tipo` ya
 * viene resuelto por la aerolínea a partir de la edad mandada en la
 * búsqueda (confirmado contra el sandbox real: mandar `{age: 8}` en la
 * búsqueda, la oferta responde `{type: 'child', age: 8}`). El frontend
 * usa este `id` para armar el formulario de cada pasajero al reservar.
 */
export interface PasajeroOfertaVuelo {
  id: string;
  tipo: 'adult' | 'child' | 'infant_without_seat';
  edad: number | null;
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
  /** Ids reales de esta oferta (uno por pasajero buscado) con el tipo ya resuelto por la aerolínea — usar esto, no adivinar por tramosCrudo. */
  pasajeros: PasajeroOfertaVuelo[];
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
  /**
   * Solo tiene sentido en el pasajero ADULTO responsable — su valor es el
   * `id` del pasajero infante que viaja con él. Confirmado contra el
   * sandbox real: Duffel exige este vínculo para crear la orden si hay
   * algún pasajero `infant_without_seat`.
   */
  infantePasajeroId?: string;
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

/** Orden real en el proveedor, para reconciliación — `canceladaEn` viene directo del recurso (Duffel expone `cancelled_at` en la propia orden, no hace falta cruzar con order_cancellations). */
export interface OrdenVueloListado {
  id: string;
  localizador: string;
  montoTotal: string;
  moneda: string;
  creadaEn: string;
  canceladaEn: string | null;
}

export interface ResultadoListadoOrdenes {
  ordenes: OrdenVueloListado[];
  /** null = no hay más páginas. */
  cursorSiguiente: string | null;
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

  /** Solo para reconciliación (Plataforma) — lista las órdenes reales de la cuenta compartida, paginado con cursor. */
  listarOrdenes(cursor?: string): Promise<ResultadoListadoOrdenes>;
}
