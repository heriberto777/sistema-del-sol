import { createHash } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { CotizacionCancelacionVuelo, ResultadoCancelacionVuelo } from './travel-provider.interface';
import {
  BuscarHotelesRequest,
  CrearReservaHotelRequest,
  DestinoHotel,
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

interface DestinoHotelbedsCrudo {
  code: string;
  name?: { content: string };
  countryCode: string;
}

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** ISO 3166 alpha-2 -> nombre en español, vía Intl (sin catálogo propio que mantener). */
const NOMBRES_PAIS = new Intl.DisplayNames(['es'], { type: 'region' });
function nombrePais(countryCode: string): string {
  try {
    return NOMBRES_PAIS.of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}

/** Bandera emoji a partir del código ISO — cada letra mapea a su "regional indicator symbol" (mismo truco que usa el resto de la industria, sin tabla propia). */
function banderaDesdeCodigoPais(countryCode: string): string {
  if (!/^[A-Z]{2}$/i.test(countryCode)) return '🏳️';
  return String.fromCodePoint(...countryCode.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)));
}

function normalizarHotel(h: HotelHotelbeds, moneda: string, tasa: number): HotelListado {
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
        montoNeto: (Number(rate.net) * tasa).toFixed(2),
        moneda,
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

  // Caché en Redis del catálogo de destinos (~7300 registros, 8 páginas de
  // 1000 — límite real del sandbox, confirmado en vivo) — Hotelbeds no
  // tiene un endpoint de "buscar por texto", así que se trae todo una vez
  // y se filtra acá. TTL generoso porque el catálogo casi no cambia, y
  // porque el Content API del sandbox tiene cuota diaria limitada
  // (confirmado en vivo: "Quota exceeded" tras reconstruir el catálogo
  // varias veces) — en memoria se perdía en cada reinicio del proceso,
  // en Redis sobrevive.
  private static readonly CLAVE_CACHE_DESTINOS = 'travel:hotelbeds:destinos';
  private static readonly CACHE_DESTINOS_TTL_SEGUNDOS = 24 * 60 * 60;

  constructor(private readonly redis: RedisService) {}

  get habilitado(): boolean {
    return Boolean(process.env.HOTELBEDS_API_KEY && process.env.HOTELBEDS_SECRET);
  }

  /** null/"EUR" = sin conversión — Hotelbeds siempre cotiza en EUR (confirmado contra el sandbox real). */
  private monedaYTasa(): { moneda: string; tasa: number } {
    const moneda = process.env.HOTELBEDS_MONEDA || 'EUR';
    if (moneda === 'EUR') return { moneda, tasa: 1 };
    const tasa = Number(process.env.HOTELBEDS_TASA_CAMBIO);
    return { moneda, tasa: Number.isFinite(tasa) && tasa > 0 ? tasa : 1 };
  }

  private convertirDesdeEur(montoEur: string | number): string {
    return (Number(montoEur) * this.monedaYTasa().tasa).toFixed(2);
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

  /**
   * Catálogo propio de Hotelbeds (Content API, `locations/destinations`) —
   * confirmado en vivo que NO son códigos IATA (ej. Santo Domingo es "DOM",
   * no "SDQ"; Santiago es "SDC", no "STI") y que no hay filtro de texto en
   * el endpoint: hay que paginar el catálogo completo (7300+ destinos, tope
   * real de 1000 por página) y filtrar acá. Se cachea en memoria por
   * proceso — ver CACHE_DESTINOS_TTL_MS.
   */
  private async obtenerCatalogoDestinos(): Promise<{ code: string; nombre: string; pais: string; bandera: string }[]> {
    const cacheado = await this.redis.obtenerJson<{ code: string; nombre: string; pais: string; bandera: string }[]>(HotelbedsAdapter.CLAVE_CACHE_DESTINOS);
    if (cacheado) return cacheado;

    const PAGE = 1000;
    const todos: DestinoHotelbedsCrudo[] = [];
    let from = 1;
    let total = Infinity;
    while (from <= total) {
      const data = await this.llamar<{ destinations: DestinoHotelbedsCrudo[]; total: number }>(
        `/hotel-content-api/1.0/locations/destinations?fields=code,name,countryCode&language=CAS&from=${from}&to=${from + PAGE - 1}`,
        'GET',
      );
      todos.push(...data.destinations);
      total = data.total;
      from += PAGE;
    }

    const catalogo = todos
      .filter((d) => d.name?.content)
      .map((d) => ({ code: d.code, nombre: d.name!.content, pais: nombrePais(d.countryCode), bandera: banderaDesdeCodigoPais(d.countryCode) }));
    await this.redis.guardarJson(HotelbedsAdapter.CLAVE_CACHE_DESTINOS, catalogo, HotelbedsAdapter.CACHE_DESTINOS_TTL_SEGUNDOS);
    return catalogo;
  }

  async buscarDestinos(query: string): Promise<DestinoHotel[]> {
    const q = normalizarTexto(query.trim());
    if (!q) return [];
    const catalogo = await this.obtenerCatalogoDestinos();
    return catalogo
      .filter((d) => normalizarTexto(d.nombre).includes(q) || normalizarTexto(d.pais).includes(q) || normalizarTexto(d.code).includes(q))
      .slice(0, 10)
      .map((d) => ({ codigo: d.code, nombre: d.nombre, pais: d.pais, bandera: d.bandera }));
  }

  async buscarHoteles(request: BuscarHotelesRequest): Promise<ResultadoBusquedaHoteles> {
    const data = await this.llamar<{ hotels?: { hotels: HotelHotelbeds[] } }>('/hotel-api/1.0/hotels', 'POST', {
      stay: { checkIn: request.checkIn, checkOut: request.checkOut },
      occupancies: [{ rooms: request.ocupacion.habitaciones, adults: request.ocupacion.adultos, children: request.ocupacion.ninos }],
      destination: { code: request.destino },
    });

    const { moneda, tasa } = this.monedaYTasa();
    return { hoteles: (data.hotels?.hotels ?? []).map((h) => normalizarHotel(h, moneda, tasa)) };
  }

  async confirmarTarifa(rateKey: string): Promise<TarifaConfirmadaHotel> {
    const data = await this.llamar<{ hotel: { rooms: RoomHotelbeds[]; totalNet: string } }>('/hotel-api/1.0/checkrates', 'POST', {
      rooms: [{ rateKey }],
    });
    const rateConfirmada = data.hotel.rooms[0]?.rates[0];
    return { rateKey: rateConfirmada?.rateKey ?? rateKey, montoNeto: this.convertirDesdeEur(data.hotel.totalNet), moneda: this.monedaYTasa().moneda };
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

    return { referencia: data.booking.reference, montoTotal: this.convertirDesdeEur(data.booking.totalNet), moneda: this.monedaYTasa().moneda };
  }

  async cotizarCancelacion(referenciaReserva: string): Promise<CotizacionCancelacionVuelo> {
    const data = await this.llamar<{ booking: { cancellationReference: string }; cancellationAmount?: number }>(
      `/hotel-api/1.0/bookings/${referenciaReserva}?cancellationFlag=SIMULATION`,
      'DELETE',
    );
    return { id: data.booking.cancellationReference, montoReembolso: this.convertirDesdeEur(data.cancellationAmount ?? 0), moneda: this.monedaYTasa().moneda };
  }

  async confirmarCancelacion(referenciaReserva: string, montoOriginal: number): Promise<ResultadoCancelacionVuelo> {
    const data = await this.llamar<{ cancellationAmount?: number }>(
      `/hotel-api/1.0/bookings/${referenciaReserva}?cancellationFlag=CANCELLATION`,
      'DELETE',
    );
    // cancellationAmount = penalidad que TODAVÍA se debe, en EUR (confirmado
    // contra el sandbox real). Se convierte a la moneda configurada ANTES de
    // restar contra montoOriginal (que ya llega en esa misma moneda — es
    // reserva.montoCosto, guardado ya convertido al crear la reserva) — lo
    // que se libera de la deuda original es la diferencia, nunca la penalidad.
    const penalidad = Number(this.convertirDesdeEur(data.cancellationAmount ?? 0));
    const montoLiberado = Math.max(0, montoOriginal - penalidad);
    return { reembolsado: montoLiberado > 0, montoReembolso: montoLiberado.toFixed(2), moneda: this.monedaYTasa().moneda };
  }
}
