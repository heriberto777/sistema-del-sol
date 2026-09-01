import { ServiceUnavailableException } from '@nestjs/common';
import { AlanubeAdapter } from './alanube.adapter';
import { EmitirECfParams } from './emisor-ecf-adapter.interface';

const PARAMS: EmitirECfParams = {
  tipo: 'E31',
  encf: 'E310000000005',
  fechaVencimientoSecuencia: new Date('2027-01-01'),
  emisor: { rnc: '101000000', razonSocial: 'Mi Empresa', direccion: 'Calle 1' },
  receptor: { rnc: '131234567', razonSocial: 'Su Empresa' },
  lineas: [{ numero: 1, descripcion: 'Producto A', cantidad: 2, precioUnitario: 100, montoTotal: 200 }],
  montoTotal: 236,
  itbisTotal: 36,
};

describe('AlanubeAdapter', () => {
  let adapter: AlanubeAdapter;
  let fetchMock: jest.Mock;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    adapter = new AlanubeAdapter();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    jest.restoreAllMocks();
  });

  it('habilitado es false sin ALANUBE_API_TOKEN', () => {
    delete process.env.ALANUBE_API_TOKEN;
    expect(adapter.habilitado).toBe(false);
  });

  it('habilitado es true con ALANUBE_API_TOKEN', () => {
    process.env.ALANUBE_API_TOKEN = 'token-de-prueba';
    expect(adapter.habilitado).toBe(true);
  });

  it('emitir lanza ServiceUnavailableException sin llamar a fetch si falta el token', async () => {
    delete process.env.ALANUBE_API_TOKEN;

    await expect(adapter.emitir(PARAMS)).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emitir arma el request contra sandbox por defecto y la ruta correcta según el tipo (E31 → fiscal-invoices)', async () => {
    process.env.ALANUBE_API_TOKEN = 'token-de-prueba';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'ulid-123' }) });

    const resultado = await adapter.emitir(PARAMS);

    expect(resultado).toEqual({ idExterno: 'ulid-123' });
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.alanube.co/dom/v1/fiscal-invoices');
    expect(opciones.headers.Authorization).toBe('Bearer token-de-prueba');
    const body = JSON.parse(opciones.body);
    expect(body.idDoc.encf).toBe('E310000000005');
    expect(body.sender.rnc).toBe('101000000');
    expect(body.totals.totalAmount).toBe(236);
  });

  it('emitir usa la URL de producción cuando ALANUBE_AMBIENTE=produccion', async () => {
    process.env.ALANUBE_API_TOKEN = 'token-de-prueba';
    process.env.ALANUBE_AMBIENTE = 'produccion';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'ulid-123' }) });

    await adapter.emitir(PARAMS);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.alanube.co/dom/v1/fiscal-invoices');
  });

  it('emitir usa la ruta debit-notes para E33', async () => {
    process.env.ALANUBE_API_TOKEN = 'token-de-prueba';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'ulid-123' }) });

    await adapter.emitir({ ...PARAMS, tipo: 'E33' });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.alanube.co/dom/v1/debit-notes');
  });

  it('emitir lanza ServiceUnavailableException si Alanube responde con error', async () => {
    process.env.ALANUBE_API_TOKEN = 'token-de-prueba';
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'validación fallida' });

    await expect(adapter.emitir(PARAMS)).rejects.toThrow(ServiceUnavailableException);
  });

  it('emitir lanza ServiceUnavailableException si la petición falla', async () => {
    process.env.ALANUBE_API_TOKEN = 'token-de-prueba';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(adapter.emitir(PARAMS)).rejects.toThrow(ServiceUnavailableException);
  });

  it('consultarEstado lanza ServiceUnavailableException sin token', async () => {
    delete process.env.ALANUBE_API_TOKEN;

    await expect(adapter.consultarEstado('ulid-123', 'E31')).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('consultarEstado mapea el status de Alanube a nuestro enum', async () => {
    process.env.ALANUBE_API_TOKEN = 'token-de-prueba';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: 'accepted' }) });

    const resultado = await adapter.consultarEstado('ulid-123', 'E31');

    expect(resultado.estado).toBe('ACEPTADO');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.alanube.co/dom/v1/fiscal-invoices/ulid-123');
  });

  it('consultarEstado devuelve EN_PROCESO para un status desconocido', async () => {
    process.env.ALANUBE_API_TOKEN = 'token-de-prueba';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: 'queued' }) });

    const resultado = await adapter.consultarEstado('ulid-123', 'E31');

    expect(resultado.estado).toBe('EN_PROCESO');
  });
});
