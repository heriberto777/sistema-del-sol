import { createHash } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { CotizacionCancelacionVuelo, ResultadoCancelacionVuelo } from './travel-provider.interface';
import {
  BuscarHotelesRequest,
  CrearReservaHotelRequest,
  HotelListado,
  HotelProvider,
  ResultadoBusquedaHoteles,
  ReservaHotelCreada,
  TarifaConfirmadaHotel,
} from './hotel-provider.interface';

const BASE_URL = 'https://api.test.hotelbeds.com';
// Sandbox de test — servidores idénticos a producción con reservas
// simuladas, no un mock aparte (confirmado contra la cuenta real). Pasar
// a producción es solo cambiar de host (api.hotelbeds.com), no de shape.

interface DuffelStyleErrorHotelbeds {
  // Confirmado contra el sandbox real: la forma de "error" varía — a
  // veces {code, message}, a veces un string suelto (ej. firma inválida)
  // — nunca asumir un solo shape.
  error?: { code?: string; message?: string } | string;
}

interface RateHotelbeds {
  rateKey: string;
  net: string;
  rateClass: string;
  paymentType: string;
  boardName: string;
  cancellationPolicies?: { amount: string; from: string }[];
}

interface RoomHotelbeds {
  code: string;
  name: string;
  rates: RateHotelbeds[];
}

interface HotelHotelbeds {
  code: number;
  name: string;
  categoryName: string;
  destinationCode: string;
  rooms: RoomHotelbeds[];
}

function normalizarHotel(h: HotelHotelbeds): HotelListado {
  return {
    codigo: h.code,
    nombre: h.name,
    categoria: h.categoryName,
    destino: h.destinationCode,
    habitaciones: h.rooms.map((r) => ({
      codigo: r.code,
      nombre: r.name,
      tarifas: r.rates.map((rate) => ({
        rateKey: rate.rateKey,
        montoNeto: rate.net,
        moneda: 'EUR', // Confirmado contra el sandbox real: Hotelbeds siempre cotiza en EUR, sin campo de moneda propio en la tarifa.
        regimen: rate.boardName,
        reembolsable: (rate.cancellationPolicies?.[0]?.amount ?? '0') !== rate.net,
      })),
    })),
  };
}

/**
 * `fetch` nativo directo contra la API de Hotelbeds — mismo criterio que
 * DuffelAdapter/StripeAdapter: sin SDK oficial. Autenticación por firma
 * (no Bearer): header `Api-key` + `X-Signature` =
 * SHA256(apiKey + secret + timestamp_segundos) en hex, recalculada en
 * cada request (confirmado contra el sandbox real).
 */
@Injectable()
export class HotelbedsAdapter implements HotelProvider {
  private readonly logger = new Logger(HotelbedsAdapter.name);
  readonly clave = 'hotelbeds';

  get habilitado(): boolean {
    return Boolean(process.env.HOTELBEDS_API_KEY && process.env.HOTELBEDS_SECRET);
  }

  private credenciales(): { apiKey: string; secret: string } {
    const apiKey = process.env.HOTELBEDS_API_KEY;
    const secret = process.env.HOTELBEDS_SECRET;
    if (!apiKey || !secret) {
      throw new ServiceUnavailableException('El proveedor de hoteles no está disponible todavía (falta configurar Hotelbeds)');
    }
    return { apiKey, secret };
  }

  private firmar(apiKey: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    return createHash('sha256').update(`${apiKey}${secret}${timestamp}`).digest('hex');
  }

  private async llamar<T>(path: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<T> {
    const { apiKey, secret } = this.credenciales();

    let respuesta: Response;
    try {
      respuesta = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          'Api-key': apiKey,
          'X-Signature': this.firmar(apiKey, secret),
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      this.logger.error('Fallo al contactar a la API de Hotelbeds', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar al proveedor de hoteles — intentá de nuevo en unos minutos');
    }

    const cuerpo = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      const detalle = cuerpo as DuffelStyleErrorHotelbeds | null;
      this.logger.error(`Hotelbeds respondió ${respuesta.status}: ${JSON.stringify(detalle)}`);
      const mensaje = typeof detalle?.error === 'string' ? detalle.error : detalle?.error?.message;
      throw new ServiceUnavailableException(mensaje ?? 'El proveedor de hoteles rechazó la solicitud');
    }

    return cuerpo as T;
  }

  async buscarHoteles(request: BuscarHotelesRequest): Promise<ResultadoBusquedaHoteles> {
    const data = await this.llamar<{ hotels?: { hotels: HotelHotelbeds[] } }>('/hotel-api/1.0/hotels', 'POST', {
      stay: { checkIn: request.checkIn, checkOut: request.checkOut },
      occupancies: [{ rooms: request.ocupacion.habitaciones, adults: request.ocupacion.adultos, children: request.ocupacion.ninos }],
      destination: { code: request.destino },
    });

    return { hoteles: (data.hotels?.hotels ?? []).map(normalizarHotel) };
  }

  async confirmarTarifa(rateKey: string): Promise<TarifaConfirmadaHotel> {
    const data = await this.llamar<{ hotel: { rooms: RoomHotelbeds[]; totalNet: string } }>('/hotel-api/1.0/checkrates', 'POST', {
      rooms: [{ rateKey }],
    });
    const rateConfirmada = data.hotel.rooms[0]?.rates[0];
    return { rateKey: rateConfirmada?.rateKey ?? rateKey, montoNeto: data.hotel.totalNet, moneda: 'EUR' };
  }

  async crearReserva(request: CrearReservaHotelRequest): Promise<ReservaHotelCreada> {
    const data = await this.llamar<{ booking: { reference: string; totalNet: number } }>('/hotel-api/1.0/bookings', 'POST', {
      holder: { name: request.titular.nombre, surname: request.titular.apellido },
      rooms: [
        {
          rateKey: request.rateKey,
          paxes: request.huespedes.map((h) => ({ roomId: 1, type: h.tipo, name: h.nombre, surname: h.apellido })),
        },
      ],
      clientReference: request.referenciaCliente,
    });

    return { referencia: data.booking.reference, montoTotal: String(data.booking.totalNet), moneda: 'EUR' };
  }

  async cotizarCancelacion(referenciaReserva: string): Promise<CotizacionCancelacionVuelo> {
    const data = await this.llamar<{ booking: { cancellationReference: string }; cancellationAmount?: number; currency: string }>(
      `/hotel-api/1.0/bookings/${referenciaReserva}?cancellationFlag=SIMULATION`,
      'DELETE',
    );
    return { id: data.booking.cancellationReference, montoReembolso: String(data.cancellationAmount ?? 0), moneda: data.currency };
  }

  async confirmarCancelacion(referenciaReserva: string, montoOriginal: number): Promise<ResultadoCancelacionVuelo> {
    const data = await this.llamar<{ cancellationAmount?: number; currency: string }>(
      `/hotel-api/1.0/bookings/${referenciaReserva}?cancellationFlag=CANCELLATION`,
      'DELETE',
    );
    // cancellationAmount = penalidad que TODAVÍA se debe (confirmado contra
    // el sandbox real). Lo que se libera de la deuda original es la
    // diferencia — eso es lo que se acredita al ledger, nunca la penalidad.
    const penalidad = data.cancellationAmount ?? 0;
    const montoLiberado = Math.max(0, montoOriginal - penalidad);
    return { reembolsado: montoLiberado > 0, montoReembolso: String(montoLiberado), moneda: data.currency };
  }
}
