import { ServiceUnavailableException } from '@nestjs/common';
import { HotelbedsAdapter } from './hotelbeds.adapter';
import { RedisService } from '../../redis/redis.service';
import { CredencialesHotelbeds } from './hotel-provider.interface';

const CREDENCIALES: CredencialesHotelbeds = { apiKey: 'key123', secret: 'secret123', moneda: 'EUR', tasaCambio: 1 };

describe('HotelbedsAdapter', () => {
  let adapter: HotelbedsAdapter;
  let fetchMock: jest.Mock;
  let redisMock: jest.Mocked<Pick<RedisService, 'obtenerJson' | 'guardarJson'>>;

  beforeEach(() => {
    redisMock = { obtenerJson: jest.fn().mockResolvedValue(null), guardarJson: jest.fn().mockResolvedValue(undefined) };
    adapter = new HotelbedsAdapter(redisMock as unknown as RedisService);
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('buscarHoteles lanza ServiceUnavailableException sin llamar a fetch si faltan las credenciales', async () => {
    await expect(
      adapter.buscarHoteles({ ...CREDENCIALES, apiKey: '' }, { destino: 'PMI', checkIn: '2026-12-10', checkOut: '2026-12-12', ocupacion: { habitaciones: 1, adultos: 2, ninos: 0 } }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('buscarHoteles manda Api-key + X-Signature y normaliza los hoteles (shape confirmado en vivo)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        hotels: {
          hotels: [
            {
              code: 766,
              name: 'Elba Sunset Mallorca Thalasso Spa',
              categoryName: '4 STARS',
              destinationCode: 'PMI',
              rooms: [
                {
                  code: 'DBL.ST',
                  name: 'Double Standard Rodas',
                  rates: [
                    { rateKey: 'RK1', net: '194.48', rateClass: 'NOR', paymentType: 'AT_WEB', boardName: 'BED AND BREAKFAST', cancellationPolicies: [{ amount: '97.24', from: '2026-12-08T23:59:00+01:00' }] },
                  ],
                },
              ],
            },
          ],
        },
      }),
    });

    const resultado = await adapter.buscarHoteles(CREDENCIALES, { destino: 'PMI', checkIn: '2026-12-10', checkOut: '2026-12-12', ocupacion: { habitaciones: 1, adultos: 2, ninos: 0 } });

    expect(resultado.hoteles).toEqual([
      {
        codigo: 766,
        nombre: 'Elba Sunset Mallorca Thalasso Spa',
        categoria: '4 STARS',
        destino: 'PMI',
        habitaciones: [
          {
            codigo: 'DBL.ST',
            nombre: 'Double Standard Rodas',
            tarifas: [{ rateKey: 'RK1', montoNeto: '194.48', moneda: 'EUR', regimen: 'BED AND BREAKFAST', reembolsable: true }],
          },
        ],
      },
    ]);

    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test.hotelbeds.com/hotel-api/1.0/hotels');
    expect(opciones.headers['Api-key']).toBe('key123');
    expect(opciones.headers['X-Signature']).toMatch(/^[a-f0-9]{64}$/);
    const cuerpo = JSON.parse(opciones.body as string);
    expect(cuerpo.destination).toEqual({ code: 'PMI' });
    expect(cuerpo.occupancies).toEqual([{ rooms: 1, adults: 2, children: 0 }]);
  });

  it('confirmarTarifa (checkrates) re-cotiza y devuelve el rateKey final', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ hotel: { totalNet: '198.36', rooms: [{ rates: [{ rateKey: 'RK1-CONFIRMADO' }] }] } }),
    });

    const resultado = await adapter.confirmarTarifa(CREDENCIALES, 'RK1');

    expect(resultado).toEqual({ rateKey: 'RK1-CONFIRMADO', montoNeto: '198.36', moneda: 'EUR' });
    const [, opciones] = fetchMock.mock.calls[0];
    expect(JSON.parse(opciones.body as string)).toEqual({ rooms: [{ rateKey: 'RK1' }] });
  });

  it('crearReserva manda holder/rooms/paxes sin ningún dato de pago (confirmado en vivo)', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ booking: { reference: '1-8322356', totalNet: 198.36 } }) });

    const resultado = await adapter.crearReserva(CREDENCIALES, {
      rateKey: 'RK1',
      titular: { nombre: 'Juan', apellido: 'Pérez' },
      huespedes: [
        { nombre: 'Juan', apellido: 'Pérez', tipo: 'AD' },
        { nombre: 'Ana', apellido: 'Pérez', tipo: 'AD' },
      ],
      referenciaCliente: 'SDS-abc12345',
    });

    expect(resultado).toEqual({ referencia: '1-8322356', montoTotal: '198.36', moneda: 'EUR' });
    const [, opciones] = fetchMock.mock.calls[0];
    const cuerpo = JSON.parse(opciones.body as string);
    expect(cuerpo.holder).toEqual({ name: 'Juan', surname: 'Pérez' });
    expect(cuerpo.rooms).toEqual([{ rateKey: 'RK1', paxes: [{ roomId: 1, type: 'AD', name: 'Juan', surname: 'Pérez' }, { roomId: 1, type: 'AD', name: 'Ana', surname: 'Pérez' }] }]);
    expect(cuerpo.payment).toBeUndefined();
    expect(cuerpo.creditCard).toBeUndefined();
  });

  it('cotizarCancelacion usa cancellationFlag=SIMULATION', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ booking: { cancellationReference: 'CANC-1' }, cancellationAmount: 0, currency: 'EUR' }) });

    const resultado = await adapter.cotizarCancelacion(CREDENCIALES, '1-8322356');

    expect(resultado).toEqual({ id: 'CANC-1', montoReembolso: '0.00', moneda: 'EUR' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test.hotelbeds.com/hotel-api/1.0/bookings/1-8322356?cancellationFlag=SIMULATION');
  });

  it('confirmarCancelacion usa cancellationFlag=CANCELLATION y acredita lo LIBERADO de la deuda, no la penalidad (confirmado en vivo)', async () => {
    // Penalidad de 50 sobre un total original de 198.36 -> se libera 148.36, no 50.
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ cancellationAmount: 50, currency: 'EUR' }) });

    const resultado = await adapter.confirmarCancelacion(CREDENCIALES, '1-8322356', 198.36);

    expect(resultado).toEqual({ reembolsado: true, montoReembolso: '148.36', moneda: 'EUR' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test.hotelbeds.com/hotel-api/1.0/bookings/1-8322356?cancellationFlag=CANCELLATION');
  });

  it('confirmarCancelacion sin penalidad libera el monto original completo', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ cancellationAmount: 0, currency: 'EUR' }) });

    const resultado = await adapter.confirmarCancelacion(CREDENCIALES, '1-8322356', 198.36);

    expect(resultado).toEqual({ reembolsado: true, montoReembolso: '198.36', moneda: 'EUR' });
  });

  it('traduce un error {error: string} (ej. firma inválida, confirmado en vivo)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Request signature verification failed' }) });

    await expect(adapter.confirmarTarifa(CREDENCIALES, 'RK1')).rejects.toThrow('Request signature verification failed');
  });

  it('traduce un error {error: {code, message}} (ej. datos inválidos, confirmado en vivo)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { code: 'INVALID_DATA', message: 'Error at property stay: Attribute is mandatory' } }) });

    await expect(adapter.confirmarTarifa(CREDENCIALES, 'RK1')).rejects.toThrow('Error at property stay: Attribute is mandatory');
  });

  it('lanza ServiceUnavailableException si la petición de red falla', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(adapter.confirmarTarifa(CREDENCIALES, 'RK1')).rejects.toThrow(ServiceUnavailableException);
  });

  describe('conversión de moneda (Hotelbeds siempre cotiza en EUR)', () => {
    it('sin moneda distinta configurada, pasa los montos de Hotelbeds tal cual en EUR', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ hotel: { totalNet: '198.36', rooms: [{ rates: [{ rateKey: 'RK1' }] }] } }) });
      const resultado = await adapter.confirmarTarifa(CREDENCIALES, 'RK1');
      expect(resultado).toEqual({ rateKey: 'RK1', montoNeto: '198.36', moneda: 'EUR' });
    });

    it('con moneda USD y una tasa configurada, convierte el monto y cambia la moneda devuelta', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ hotel: { totalNet: '100.00', rooms: [{ rates: [{ rateKey: 'RK1' }] }] } }) });

      const resultado = await adapter.confirmarTarifa({ ...CREDENCIALES, moneda: 'USD', tasaCambio: 1.08 }, 'RK1');

      expect(resultado).toEqual({ rateKey: 'RK1', montoNeto: '108.00', moneda: 'USD' });
    });

    it('confirmarCancelacion convierte la penalidad ANTES de restarla del monto original (ambos ya en la moneda configurada)', async () => {
      // Penalidad real de Hotelbeds: 50 EUR -> 55 USD. Original ya guardado en USD: 218.196 (198.36 EUR * 1.10).
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ cancellationAmount: 50 }) });

      const resultado = await adapter.confirmarCancelacion({ ...CREDENCIALES, moneda: 'USD', tasaCambio: 1.1 }, '1-8322356', 218.2);

      expect(resultado).toEqual({ reembolsado: true, montoReembolso: '163.20', moneda: 'USD' });
    });
  });

  describe('buscarDestinos', () => {
    it('devuelve [] sin llamar a fetch si la consulta está vacía', async () => {
      const resultado = await adapter.buscarDestinos(CREDENCIALES, '   ');
      expect(resultado).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('pagina el catálogo completo (tope real de 1000 por página) y filtra sin distinguir acentos/mayúsculas', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            total: 3,
            destinations: [
              { code: 'DOM', name: { content: 'Santo Domingo' }, countryCode: 'DO' },
              { code: 'PMI', name: { content: 'Palma de Mallorca' }, countryCode: 'ES' },
              { code: 'S1E', countryCode: 'DO' }, // sin name — se descarta, no es buscable por texto
            ],
          }),
        });

      const resultado = await adapter.buscarDestinos(CREDENCIALES, 'santo');

      expect(resultado).toEqual([{ codigo: 'DOM', nombre: 'Santo Domingo', pais: 'República Dominicana', bandera: '🇩🇴' }]);
      // Una sola página porque total(3) <= PAGE(1000)
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opciones] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.test.hotelbeds.com/hotel-content-api/1.0/locations/destinations?fields=code,name,countryCode&language=CAS&from=1&to=1000');
      expect(opciones.method).toBe('GET');
    });

    it('cachea el catálogo en Redis — una segunda búsqueda no vuelve a pedir las páginas a Hotelbeds', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 1, destinations: [{ code: 'PUJ', name: { content: 'Punta Cana' }, countryCode: 'DO' }] }),
      });

      await adapter.buscarDestinos(CREDENCIALES, 'punta');
      expect(redisMock.guardarJson).toHaveBeenCalledWith(
        'travel:hotelbeds:destinos',
        [{ code: 'PUJ', nombre: 'Punta Cana', pais: 'República Dominicana', bandera: '🇩🇴' }],
        24 * 60 * 60,
      );

      // Simula el hit de caché que guardarJson dejó guardado.
      redisMock.obtenerJson.mockResolvedValue([{ code: 'PUJ', nombre: 'Punta Cana', pais: 'República Dominicana', bandera: '🇩🇴' }]);
      const resultado2 = await adapter.buscarDestinos(CREDENCIALES, 'cana');

      expect(resultado2).toEqual([{ codigo: 'PUJ', nombre: 'Punta Cana', pais: 'República Dominicana', bandera: '🇩🇴' }]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('un cache-hit en Redis no llama a fetch en absoluto', async () => {
      redisMock.obtenerJson.mockResolvedValue([{ code: 'DOM', nombre: 'Santo Domingo', pais: 'República Dominicana', bandera: '🇩🇴' }]);

      const resultado = await adapter.buscarDestinos(CREDENCIALES, 'santo');

      expect(resultado).toEqual([{ codigo: 'DOM', nombre: 'Santo Domingo', pais: 'República Dominicana', bandera: '🇩🇴' }]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
