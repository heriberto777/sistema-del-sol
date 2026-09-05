import { IaClientService } from './ia-client.service';

describe('IaClientService', () => {
  let client: IaClientService;
  let fetchMock: jest.Mock;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    client = new IaClientService();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    jest.restoreAllMocks();
  });

  it('habilitado es false sin ANTHROPIC_API_KEY', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(client.habilitado).toBe(false);
  });

  it('completar devuelve null (y no llama a fetch) sin la API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const resultado = await client.completar('hola');

    expect(resultado).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('completar llama a la Messages API con x-api-key y devuelve el texto de la respuesta', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'Respuesta generada' }] }) });

    const resultado = await client.completar('hola');

    expect(resultado).toBe('Respuesta generada');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'sk-ant-test' }) }),
    );
  });

  it('completar devuelve null si Anthropic responde con error', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    const resultado = await client.completar('hola');

    expect(resultado).toBeNull();
  });

  it('completar devuelve null si la petición falla', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    const resultado = await client.completar('hola');

    expect(resultado).toBeNull();
  });
});
