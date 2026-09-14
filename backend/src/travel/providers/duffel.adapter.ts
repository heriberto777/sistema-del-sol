import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  BuscarVuelosRequest,
  CotizacionCancelacionVuelo,
  CrearOrdenVueloRequest,
  OfertaVuelo,
  OrdenVuelo,
  ResultadoBusquedaVuelos,
  ResultadoCancelacionVuelo,
  TravelProvider,
} from './travel-provider.interface';

const BASE_URL = 'https://api.duffel.com';
// Duffel versiona por header (no por la URL) — v1 se retira recién 6
// meses después de liberar una versión nueva, así que fijar esto es
// seguro; subir de versión es un cambio deliberado, no automático.
const DUFFEL_VERSION = 'v2';

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

  private async llamar<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
    const token = this.requerirToken();

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
      this.logger.error('Fallo al contactar a la API de Duffel', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar al proveedor de vuelos — intentá de nuevo en unos minutos');
    }

    const cuerpo = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      const detalle = cuerpo as ErrorDuffel | null;
      const primerError = detalle?.errors?.[0];
      this.logger.error(`Duffel respondió ${respuesta.status}: ${JSON.stringify(detalle)}`);

      if (primerError?.code === 'offer_no_longer_available' || primerError?.code === 'offer_expired') {
        throw new ServiceUnavailableException('Esta oferta ya expiró o fue reservada — hay que buscar de nuevo.');
      }
      if (primerError?.code === 'price_changed') {
        throw new ServiceUnavailableException('El precio de esta oferta cambió — hay que revalidarla antes de reservar.');
      }
      if (primerError?.type === 'rate_limit_error') {
        throw new ServiceUnavailableException('El proveedor de vuelos está limitando las solicitudes — intentá de nuevo en unos segundos.');
      }
      throw new ServiceUnavailableException(primerError?.message ?? primerError?.title ?? 'El proveedor de vuelos rechazó la solicitud');
    }

    return (cuerpo as { data: T }).data;
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
    });

    return {
      solicitudId: data.id,
      ofertas: data.offers.map(normalizarOferta),
    };
  }

  async obtenerOferta(ofertaId: string): Promise<OfertaVuelo> {
    const o = await this.llamar<DuffelOferta>(`/air/offers/${ofertaId}`, { method: 'GET' });
    return normalizarOferta(o);
  }

  async crearOrdenVuelo(request: CrearOrdenVueloRequest): Promise<OrdenVuelo> {
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
    const cancelacion = await this.llamar<{ id: string; refund_amount: string | null; refund_currency: string | null }>('/air/order_cancellations', {
      method: 'POST',
      body: { order_id: ordenId },
    });
    return { id: cancelacion.id, montoReembolso: cancelacion.refund_amount, moneda: cancelacion.refund_currency };
  }

  async confirmarCancelacion(cancelacionId: string): Promise<ResultadoCancelacionVuelo> {
    const confirmada = await this.llamar<{ refund_amount: string | null; refund_currency: string | null }>(
      `/air/order_cancellations/${cancelacionId}/actions/confirm`,
      { method: 'POST' },
    );
    return { reembolsado: Boolean(confirmada.refund_amount), montoReembolso: confirmada.refund_amount, moneda: confirmada.refund_currency };
  }
}
