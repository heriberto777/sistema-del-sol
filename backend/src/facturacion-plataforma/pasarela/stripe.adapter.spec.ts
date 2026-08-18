import { ServiceUnavailableException } from '@nestjs/common';
import { StripeAdapter } from './stripe.adapter';

describe('StripeAdapter', () => {
  let adapter: StripeAdapter;
  let fetchMock: jest.Mock;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    adapter = new StripeAdapter();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    jest.restoreAllMocks();
  });

  it('habilitado es false sin STRIPE_SECRET_KEY', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(adapter.habilitado).toBe(false);
  });

  it('habilitado es true con STRIPE_SECRET_KEY', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    expect(adapter.habilitado).toBe(true);
  });

  it('crearSesionPago lanza ServiceUnavailableException sin llamar a fetch si falta la API key', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    await expect(
      adapter.crearSesionPago({
        facturaId: 'f1',
        concepto: 'Suscripción',
        montoPendiente: 100,
        successUrl: 'https://x.com/exito',
        cancelUrl: 'https://x.com/cancelado',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('crearSesionPago llama a la API de Stripe y devuelve url/referenciaExterna', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_CURRENCY = 'usd';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/cs_test_1' }) });

    const resultado = await adapter.crearSesionPago({
      facturaId: 'f1',
      concepto: 'Suscripción Premium',
      montoPendiente: 1500,
      successUrl: 'https://x.com/exito',
      cancelUrl: 'https://x.com/cancelado',
    });

    expect(resultado).toEqual({ url: 'https://checkout.stripe.com/cs_test_1', referenciaExterna: 'cs_test_1' });
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(opciones.headers.Authorization).toBe('Bearer sk_test_123');
    const cuerpo = opciones.body as URLSearchParams;
    expect(cuerpo.get('line_items[0][price_data][unit_amount]')).toBe('150000');
    expect(cuerpo.get('metadata[facturaId]')).toBe('f1');
  });

  it('crearSesionPago lanza ServiceUnavailableException si Stripe responde con error', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });

    await expect(
      adapter.crearSesionPago({
        facturaId: 'f1',
        concepto: 'x',
        montoPendiente: 100,
        successUrl: 'https://x.com/exito',
        cancelUrl: 'https://x.com/cancelado',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('crearSesionPago lanza ServiceUnavailableException si la petición falla', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(
      adapter.crearSesionPago({
        facturaId: 'f1',
        concepto: 'x',
        montoPendiente: 100,
        successUrl: 'https://x.com/exito',
        cancelUrl: 'https://x.com/cancelado',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
