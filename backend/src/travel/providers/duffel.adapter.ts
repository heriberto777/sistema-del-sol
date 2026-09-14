import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  BuscarVuelosRequest,
  CotizacionCancelacionVuelo,
  CrearOrdenVueloRequest,
  OfertaVuelo,
  OrdenVuelo,
  ResultadoBusquedaVuelos,
  ResultadoCancelacionVuelo,
  ResultadoListadoOrdenes,
  TravelProvider,
} from './travel-provider.interface';

const BASE_URL = 'https://api.duffel.com';
// Duffel versiona por header (no por la URL) — v1 se retira recién 6
// meses después de liberar una versión nueva, así que fijar esto es
// seguro; subir de versión es un cambio deliberado, no automático.
const DUFFEL_VERSION = 'v2';

// Rate limiting — confirmado contra la doc pública de Duffel: 429 trae
// el header `ratelimit-reset` en formato de fecha RFC 2616 ("esperá
// hasta esa hora y reintentá"). Un 429 significa que la petición NUNCA
// se procesó (rechazada antes de tocar nada) — a diferencia de un fallo
// de red, reintentarlo es SIEMPRE seguro, sin importar si la operación
// mueve dinero o no. Si la espera pedida es más larga que el tope, se
// desiste y se deja el mensaje de error de siempre — no tiene sentido
// bloquear una request HTTP del usuario 30+ segundos.
const MAX_REINTENTOS_RATE_LIMIT = 2;
const MAX_ESPERA_RATE_LIMIT_MS = 5_000;
const ESPERA_RATE_LIMIT_DEFAULT_MS = 2_000; // sin header (o ilegible) — backoff fijo conservador.

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** null = no reintentar (no vino el header y no hay más info, o la espera excede el tope). */
function calcularEsperaRateLimit(headers: Headers): number | null {
  const resetHeader = headers.get('ratelimit-reset');
  if (!resetHeader) return ESPERA_RATE_LIMIT_DEFAULT_MS;
  const resetTimestamp = Date.parse(resetHeader);
  if (Number.isNaN(resetTimestamp)) return ESPERA_RATE_LIMIT_DEFAULT_MS;
  const esperaMs = resetTimestamp - Date.now();
  return esperaMs > 0 ? esperaMs : 0;
}

interface ErrorDuffel {
  errors?: { type: string; title: string; message?: string; code?: string }[];
}

interface DuffelOferta {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at: string;
  owner: { name: string };
  slices: unknown;
  // Confirmado contra el sandbox real: cada oferta trae su propia lista
  // de pasajeros con el `type` ya resuelto por la aerolínea a partir de
  // la `age` mandada en la búsqueda (age 8 -> "child", age 1 ->
  // "infant_without_seat") — nunca hay que adivinarlo por tramosCrudo.
  passengers: { id: string; type: string | null; age: number | null }[];
}

interface DuffelOrdenListado {
  id: string;
  booking_reference: string;
  total_amount: string;
  total_currency: string;
  created_at: string;
  // Confirmado contra el sandbox real: viene directo en la orden, no hace falta cruzar con /air/order_cancellations.
  cancelled_at: string | null;
}

function normalizarOferta(o: DuffelOferta): OfertaVuelo {
  return {
    id: o.id,
    aerolinea: o.owner.name,
    montoTotal: o.total_amount,
    moneda: o.total_currency,
    expiraEn: o.expires_at,
    tramosCrudo: o.slices,
    pasajeros: o.passengers.map((p) => ({ id: p.id, tipo: (p.type ?? 'adult') as 'adult' | 'child' | 'infant_without_seat', edad: p.age })),
  };
}

/**
 * `fetch` nativo directo contra la REST API de Duffel — mismo criterio
 * que StripeAdapter/AlanubeAdapter: sin SDK oficial (existe `@duffel/api`
 * en npm, pero un puñado de llamadas HTTP no lo justifica). Sin
 * DUFFEL_API_TOKEN, degrada con un error claro en vez de crashear.
 *
 * Todas las formas devueltas son las normalizadas de TravelProvider, no
 * el JSON crudo de Duffel — ver ese archivo para el porqué.
 */
@Injectable()
export class DuffelAdapter implements TravelProvider {
  private readonly logger = new Logger(DuffelAdapter.name);
  readonly clave = 'duffel';

  get habilitado(): boolean {
    return Boolean(process.env.DUFFEL_API_TOKEN);
  }

  private requerirToken(): string {
    const token = process.env.DUFFEL_API_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException('El proveedor de vuelos no está disponible todavía (falta DUFFEL_API_TOKEN)');
    }
    return token;
  }

  private async llamar<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown; reintentarEnFalloDeRed?: boolean }): Promise<T> {
    const cuerpo = await this.llamarCrudo(path, init);
    return (cuerpo as { data: T }).data;
  }

  /**
   * Igual que llamar(), pero sin descartar `meta` — lo necesita
   * listarOrdenes() para el cursor de paginación.
   *
   * Reintentos:
   * - 429 (rate_limit_error): SIEMPRE se reintenta (esperando lo que
   *   pida `ratelimit-reset`, con tope) sin importar el endpoint — un
   *   429 significa que Duffel rechazó la petición ANTES de procesarla,
   *   así que no hay riesgo de duplicar nada (ver comentario arriba).
   * - Fallo de red / 5xx: solo si `reintentarEnFalloDeRed: true` — acá
   *   SÍ hay ambigüedad sobre si el proveedor llegó a procesar la
   *   petición, así que nunca se activa para crearOrdenVuelo (reservar)
   *   ni confirmarCancelacion (reembolsar): un reintento ciego podría
   *   duplicar una orden real o un reembolso real. Solo lo usan
   *   operaciones de lectura/búsqueda (buscarVuelos, obtenerOferta,
   *   listarOrdenes), donde reintentar es inofensivo.
   */
  private async llamarCrudo(
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown; reintentarEnFalloDeRed?: boolean },
  ): Promise<{ data: unknown; meta?: { after: string | null } }> {
    const token = this.requerirToken();
    const maxReintentosRed = init.reintentarEnFalloDeRed ? 2 : 0;

    let intentosRateLimit = 0;
    let intentosRed = 0;

    for (;;) {
      let respuesta: Response;
      try {
        respuesta = await fetch(`${BASE_URL}${path}`, {
          method: init.method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Duffel-Version': DUFFEL_VERSION,
            Accept: 'application/json',
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: init.body ? JSON.stringify({ data: init.body }) : undefined,
        });
      } catch (error) {
        if (intentosRed < maxReintentosRed) {
          intentosRed++;
          this.logger.warn(`Fallo de red contra Duffel — reintentando (${intentosRed}/${maxReintentosRed})`);
          await esperar(500 * intentosRed);
          continue;
        }
        this.logger.error('Fallo al contactar a la API de Duffel', error as Error);
        throw new ServiceUnavailableException('No se pudo contactar al proveedor de vuelos — intentá de nuevo en unos minutos');
      }

      const cuerpo = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        const detalle = cuerpo as ErrorDuffel | null;
        const primerError = detalle?.errors?.[0];

        if (primerError?.type === 'rate_limit_error') {
          const esperaMs = calcularEsperaRateLimit(respuesta.headers);
          if (esperaMs !== null && esperaMs <= MAX_ESPERA_RATE_LIMIT_MS && intentosRateLimit < MAX_REINTENTOS_RATE_LIMIT) {
            intentosRateLimit++;
            this.logger.warn(`Duffel limitó la solicitud — reintentando en ${esperaMs}ms (${intentosRateLimit}/${MAX_REINTENTOS_RATE_LIMIT})`);
            await esperar(esperaMs);
            continue;
          }
          this.logger.error(`Duffel respondió 429 tras agotar los reintentos: ${JSON.stringify(detalle)}`);
          throw new ServiceUnavailableException('El proveedor de vuelos está limitando las solicitudes — intentá de nuevo en unos segundos.');
        }

        if (respuesta.status >= 500 && intentosRed < maxReintentosRed) {
          intentosRed++;
          this.logger.warn(`Duffel respondió ${respuesta.status} — reintentando (${intentosRed}/${maxReintentosRed})`);
          await esperar(500 * intentosRed);
          continue;
        }

        this.logger.error(`Duffel respondió ${respuesta.status}: ${JSON.stringify(detalle)}`);

        if (primerError?.code === 'offer_no_longer_available' || primerError?.code === 'offer_expired') {
          throw new ServiceUnavailableException('Esta oferta ya expiró o fue reservada — hay que buscar de nuevo.');
        }
        if (primerError?.code === 'price_changed') {
          throw new ServiceUnavailableException('El precio de esta oferta cambió — hay que revalidarla antes de reservar.');
        }
        throw new ServiceUnavailableException(primerError?.message ?? primerError?.title ?? 'El proveedor de vuelos rechazó la solicitud');
      }

      return cuerpo as { data: unknown; meta?: { after: string | null } };
    }
  }

  async buscarVuelos(request: BuscarVuelosRequest): Promise<ResultadoBusquedaVuelos> {
    const data = await this.llamar<{
      id: string;
      offers: DuffelOferta[];
    }>('/air/offer_requests?return_offers=true', {
      method: 'POST',
      body: {
        slices: request.tramos.map((t) => ({ origin: t.origen, destination: t.destino, departure_date: t.fecha })),
        // Uno u otro por pasajero — nunca ambos (confirmado contra el sandbox real). La edad gana si por error vinieran los dos.
        passengers: request.pasajeros.map((p) => (p.edad != null ? { age: p.edad } : { type: p.tipo })),
        cabin_class: request.cabina,
      },
      // Solo búsqueda, sin efecto secundario que duplicar — seguro reintentar ante un fallo de red.
      reintentarEnFalloDeRed: true,
    });

    return {
      solicitudId: data.id,
      ofertas: data.offers.map(normalizarOferta),
    };
  }

  async obtenerOferta(ofertaId: string): Promise<OfertaVuelo> {
    const o = await this.llamar<DuffelOferta>(`/air/offers/${ofertaId}`, { method: 'GET', reintentarEnFalloDeRed: true });
    return normalizarOferta(o);
  }

  async crearOrdenVuelo(request: CrearOrdenVueloRequest): Promise<OrdenVuelo> {
    // Nunca reintentarEnFalloDeRed acá: si la red falla justo después de que
    // Duffel ya procesó el cobro/la reserva, un reintento automático
    // podría duplicar una orden real (y cobrar el Balance dos veces). Si
    // falla, el usuario tiene que revisar el estado (reconciliación de
    // Plataforma) antes de reintentar a mano.
    const orden = await this.llamar<{ id: string; booking_reference: string; total_amount: string; total_currency: string }>('/air/orders', {
      method: 'POST',
      body: {
        type: 'instant',
        selected_offers: [request.ofertaId],
        passengers: request.pasajeros.map((p) => ({
          id: p.id,
          given_name: p.nombre,
          family_name: p.apellido,
          born_on: p.fechaNacimiento,
          gender: p.genero,
          title: p.titulo,
          email: p.email,
          phone_number: p.telefono,
          // Confirmado contra el sandbox real: Duffel acepta este shape sin
          // error aunque la ruta no lo exija — se manda solo si el
          // pasajero aportó los 3 datos (ver comentario en la interfaz).
          ...(p.numeroPasaporte && p.paisEmisionPasaporte && p.fechaVencimientoPasaporte
            ? {
                identity_documents: [
                  { type: 'passport', unique_identifier: p.numeroPasaporte, issuing_country_code: p.paisEmisionPasaporte, expires_on: p.fechaVencimientoPasaporte },
                ],
              }
            : {}),
          // Confirmado contra el sandbox real: va en el pasajero ADULTO
          // responsable, apuntando al id del pasajero infante.
          ...(p.infantePasajeroId ? { infant_passenger_id: p.infantePasajeroId } : {}),
        })),
        // Confirmado contra el sandbox real: `payments` es un ARRAY, no un
        // objeto suelto (la documentación que consulté antes de escribir
        // esto decía lo contrario — corregido al probar en vivo).
        payments: [{ type: 'balance', currency: request.monedaBalance, amount: request.montoBalance.toFixed(2) }],
      },
    });

    return { id: orden.id, localizador: orden.booking_reference, montoTotal: orden.total_amount, moneda: orden.total_currency };
  }

  async cotizarCancelacion(ordenId: string): Promise<CotizacionCancelacionVuelo> {
    // No mueve dinero, pero SÍ crea un recurso en Duffel — mismo criterio conservador, mejor que el usuario reintente a mano si falla.
    const cancelacion = await this.llamar<{ id: string; refund_amount: string | null; refund_currency: string | null }>('/air/order_cancellations', {
      method: 'POST',
      body: { order_id: ordenId },
    });
    return { id: cancelacion.id, montoReembolso: cancelacion.refund_amount, moneda: cancelacion.refund_currency };
  }

  async confirmarCancelacion(cancelacionId: string): Promise<ResultadoCancelacionVuelo> {
    // Igual criterio que crearOrdenVuelo — esto ejecuta el reembolso real, nunca reintentar a ciegas ante un fallo de red.
    const confirmada = await this.llamar<{ refund_amount: string | null; refund_currency: string | null }>(
      `/air/order_cancellations/${cancelacionId}/actions/confirm`,
      { method: 'POST' },
    );
    return { reembolsado: Boolean(confirmada.refund_amount), montoReembolso: confirmada.refund_amount, moneda: confirmada.refund_currency };
  }

  async listarOrdenes(cursor?: string): Promise<ResultadoListadoOrdenes> {
    const params = new URLSearchParams({ limit: '50' });
    if (cursor) params.set('after', cursor);

    const cuerpo = await this.llamarCrudo(`/air/orders?${params.toString()}`, { method: 'GET', reintentarEnFalloDeRed: true });
    const ordenes = cuerpo.data as DuffelOrdenListado[];

    return {
      ordenes: ordenes.map((o) => ({
        id: o.id,
        localizador: o.booking_reference,
        montoTotal: o.total_amount,
        moneda: o.total_currency,
        creadaEn: o.created_at,
        canceladaEn: o.cancelled_at,
      })),
      cursorSiguiente: cuerpo.meta?.after ?? null,
    };
  }
}
