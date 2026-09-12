import { ServiceUnavailableException } from '@nestjs/common';
import { DuffelAdapter } from './duffel.adapter';

describe('DuffelAdapter', () => {
  let adapter: DuffelAdapter;
  let fetchMock: jest.Mock;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    adapter = new DuffelAdapter();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    jest.restoreAllMocks();
  });

  it('habilitado es false sin DUFFEL_API_TOKEN', () => {
    delete process.env.DUFFEL_API_TOKEN;
    expect(adapter.habilitado).toBe(false);
  });

  it('habilitado es true con DUFFEL_API_TOKEN', () => {
    process.env.DUFFEL_API_TOKEN = 'duffel_test_123';
    expect(adapter.habilitado).toBe(true);
  });

  it('buscarVuelos lanza ServiceUnavailableException sin llamar a fetch si falta el token', async () => {
    delete process.env.DUFFEL_API_TOKEN;

    await expect(
      adapter.buscarVuelos({ tramos: [{ origen: 'SDQ', destino: 'MAD', fecha: '2026-11-10' }], pasajeros: [{ tipo: 'adult' }] }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('buscarVuelos llama a /air/offer_requests con el header Duffel-Version y normaliza las ofertas', async () => {
    process.env.DUFFEL_API_TOKEN = 'duffel_test_123';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'orq_1',
          offers: [
            { id: 'off_1', total_amount: '450.00', total_currency: 'USD', expires_at: '2026-11-01T00:00:00Z', owner: { name: 'Iberia' }, slices: [{ x: 1 }] },
          ],
        },
      }),
    });

    const resultado = await adapter.buscarVuelos({
      tramos: [{ origen: 'SDQ', destino: 'MAD', fecha: '2026-11-10' }],
      pasajeros: [{ tipo: 'adult' }],
      cabina: 'economy',
    });

    expect(resultado.solicitudId).toBe('orq_1');
    expect(resultado.ofertas).toEqual([
      { id: 'off_1', aerolinea: 'Iberia', montoTotal: '450.00', moneda: 'USD', expiraEn: '2026-11-01T00:00:00Z', tramosCrudo: [{ x: 1 }] },
    ]);

    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.duffel.com/air/offer_requests?return_offers=true');
    expect(opciones.headers['Duffel-Version']).toBe('v2');
    expect(opciones.headers.Authorization).toBe('Bearer duffel_test_123');
    const cuerpo = JSON.parse(opciones.body as string);
    expect(cuerpo.data.slices).toEqual([{ origin: 'SDQ', destination: 'MAD', departure_date: '2026-11-10' }]);
    expect(cuerpo.data.passengers).toEqual([{ type: 'adult' }]);
  });

  it('crearOrdenVuelo manda el pago como Balance (nunca tarjeta) y devuelve el localizador', async () => {
    process.env.DUFFEL_API_TOKEN = 'duffel_test_123';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'ord_1', booking_reference: 'ABC123', total_amount: '450.00', total_currency: 'USD' } }),
    });

    const resultado = await adapter.crearOrdenVuelo({
      ofertaId: 'off_1',
      pasajeros: [{ id: 'pas_1', nombre: 'Juan', apellido: 'Pérez', fechaNacimiento: '1990-01-01', genero: 'm', email: 'j@x.com', telefono: '+18095551234' }],
      montoBalance: 450,
      monedaBalance: 'USD',
    });

    expect(resultado).toEqual({ id: 'ord_1', localizador: 'ABC123', montoTotal: '450.00', moneda: 'USD' });
    const [, opciones] = fetchMock.mock.calls[0];
    const cuerpo = JSON.parse(opciones.body as string);
    expect(cuerpo.data.payments).toEqual({ type: 'balance', currency: 'USD', amount: '450.00' });
    expect(cuerpo.data.selected_offers).toEqual(['off_1']);
  });

  it('traduce offer_no_longer_available a un mensaje de negocio claro', async () => {
    process.env.DUFFEL_API_TOKEN = 'duffel_test_123';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ errors: [{ type: 'airline_error', code: 'offer_no_longer_available', title: 'Offer no longer available' }] }),
    });

    await expect(adapter.obtenerOferta('off_expirada')).rejects.toThrow(/expiró o fue reservada/);
  });

  it('traduce rate_limit_error a un mensaje de negocio claro', async () => {
    process.env.DUFFEL_API_TOKEN = 'duffel_test_123';
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ errors: [{ type: 'rate_limit_error', title: 'Too many requests' }] }) });

    await expect(adapter.obtenerOferta('off_1')).rejects.toThrow(/limitando las solicitudes/);
  });

  it('cotizarCancelacion y confirmarCancelacion siguen el flujo de 2 pasos', async () => {
    process.env.DUFFEL_API_TOKEN = 'duffel_test_123';
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'orc_1', refund_amount: '300.00', refund_currency: 'USD' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { refund_amount: '300.00', refund_currency: 'USD' } }) });

    const cotizacion = await adapter.cotizarCancelacion('ord_1');
    expect(cotizacion).toEqual({ id: 'orc_1', montoReembolso: '300.00', moneda: 'USD' });

    const confirmacion = await adapter.confirmarCancelacion('orc_1');
    expect(confirmacion).toEqual({ reembolsado: true, montoReembolso: '300.00', moneda: 'USD' });

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.duffel.com/air/order_cancellations');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.duffel.com/air/order_cancellations/orc_1/actions/confirm');
  });

  it('lanza ServiceUnavailableException si la petición de red falla', async () => {
    process.env.DUFFEL_API_TOKEN = 'duffel_test_123';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(adapter.obtenerOferta('off_1')).rejects.toThrow(ServiceUnavailableException);
  });
});
