import { ServiceUnavailableException } from '@nestjs/common';
import { HotelbedsAdapter } from './hotelbeds.adapter';

describe('HotelbedsAdapter', () => {
  let adapter: HotelbedsAdapter;
  let fetchMock: jest.Mock;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    adapter = new HotelbedsAdapter();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    jest.restoreAllMocks();
  });

  it('habilitado es false sin API key o sin secret', () => {
    delete process.env.HOTELBEDS_API_KEY;
    delete process.env.HOTELBEDS_SECRET;
    expect(adapter.habilitado).toBe(false);

    process.env.HOTELBEDS_API_KEY = 'key123';
    expect(adapter.habilitado).toBe(false); // falta el secret

    process.env.HOTELBEDS_SECRET = 'secret123';
    expect(adapter.habilitado).toBe(true);
  });

  it('buscarHoteles lanza ServiceUnavailableException sin llamar a fetch si faltan las credenciales', async () => {
    delete process.env.HOTELBEDS_API_KEY;
    await expect(adapter.buscarHoteles({ destino: 'PMI', checkIn: '2026-12-10', checkOut: '2026-12-12', ocupacion: { habitaciones: 1, adultos: 2, ninos: 0 } })).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('buscarHoteles manda Api-key + X-Signature y normaliza los hoteles (shape confirmado en vivo)', async () => {
    process.env.HOTELBEDS_API_KEY = 'key123';
    process.env.HOTELBEDS_SECRET = 'secret123';
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

    const resultado = await adapter.buscarHoteles({ destino: 'PMI', checkIn: '2026-12-10', checkOut: '2026-12-12', ocupacion: { habitaciones: 1, adultos: 2, ninos: 0 } });

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
    process.env.HOTELBEDS_API_KEY = 'key123';
    process.env.HOTELBEDS_SECRET = 'secret123';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ hotel: { totalNet: '198.36', rooms: [{ rates: [{ rateKey: 'RK1-CONFIRMADO' }] }] } }),
    });

    const resultado = await adapter.confirmarTarifa('RK1');

    expect(resultado).toEqual({ rateKey: 'RK1-CONFIRMADO', montoNeto: '198.36', moneda: 'EUR' });
    const [, opciones] = fetchMock.mock.calls[0];
    expect(JSON.parse(opciones.body as string)).toEqual({ rooms: [{ rateKey: 'RK1' }] });
  });

  it('crearReserva manda holder/rooms/paxes sin ningún dato de pago (confirmado en vivo)', async () => {
    process.env.HOTELBEDS_API_KEY = 'key123';
    process.env.HOTELBEDS_SECRET = 'secret123';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ booking: { reference: '1-8322356', totalNet: 198.36 } }) });

    const resultado = await adapter.crearReserva({
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
    process.env.HOTELBEDS_API_KEY = 'key123';
    process.env.HOTELBEDS_SECRET = 'secret123';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ booking: { cancellationReference: 'CANC-1' }, cancellationAmount: 0, currency: 'EUR' }) });

    const resultado = await adapter.cotizarCancelacion('1-8322356');

    expect(resultado).toEqual({ id: 'CANC-1', montoReembolso: '0', moneda: 'EUR' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test.hotelbeds.com/hotel-api/1.0/bookings/1-8322356?cancellationFlag=SIMULATION');
  });

  it('confirmarCancelacion usa cancellationFlag=CANCELLATION y acredita lo LIBERADO de la deuda, no la penalidad (confirmado en vivo)', async () => {
    process.env.HOTELBEDS_API_KEY = 'key123';
    process.env.HOTELBEDS_SECRET = 'secret123';
    // Penalidad de 50 sobre un total original de 198.36 -> se libera 148.36, no 50.
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ cancellationAmount: 50, currency: 'EUR' }) });

    const resultado = await adapter.confirmarCancelacion('1-8322356', 198.36);

    expect(resultado).toEqual({ reembolsado: true, montoReembolso: '148.36', moneda: 'EUR' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test.hotelbeds.com/hotel-api/1.0/bookings/1-8322356?cancellationFlag=CANCELLATION');
  });

  it('confirmarCancelacion sin penalidad libera el monto original completo', async () => {
    process.env.HOTELBEDS_API_KEY = 'key123';
    process.env.HOTELBEDS_SECRET = 'secret123';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ cancellationAmount: 0, currency: 'EUR' }) });

    const resultado = await adapter.confirmarCancelacion('1-8322356', 198.36);

    expect(resultado).toEqual({ reembolsado: true, montoReembolso: '198.36', moneda: 'EUR' });
  });

  it('traduce un error {error: string} (ej. firma inválida, confirmado en vivo)', async () => {
    process.env.HOTELBEDS_API_KEY = 'key123';
    process.env.HOTELBEDS_SECRET = 'secret123';
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Request signature verification failed' }) });

    await expect(adapter.confirmarTarifa('RK1')).rejects.toThrow('Request signature verification failed');
  });

  it('traduce un error {error: {code, message}} (ej. datos inválidos, confirmado en vivo)', async () => {
    process.env.HOTELBEDS_API_KEY = 'key123';
    process.env.HOTELBEDS_SECRET = 'secret123';
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { code: 'INVALID_DATA', message: 'Error at property stay: Attribute is mandatory' } }) });

    await expect(adapter.confirmarTarifa('RK1')).rejects.toThrow('Error at property stay: Attribute is mandatory');
  });

  it('lanza ServiceUnavailableException si la petición de red falla', async () => {
    process.env.HOTELBEDS_API_KEY = 'key123';
    process.env.HOTELBEDS_SECRET = 'secret123';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(adapter.confirmarTarifa('RK1')).rejects.toThrow(ServiceUnavailableException);
  });
});
