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

  describe('completarConversacion', () => {
    it('usa la apiKey de opciones en vez de la de plataforma', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-plataforma';
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: '{"respuesta":"hola"}' }] }) });

      await client.completarConversacion([{ role: 'user', content: 'hola' }], { apiKey: 'sk-ant-tenant' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'sk-ant-tenant' }) }),
      );
    });

    it('sin apiKey de opciones ni de plataforma, devuelve null sin llamar a fetch (no cobra a la plataforma el uso de un tenant)', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const resultado = await client.completarConversacion([{ role: 'user', content: 'hola' }]);

      expect(resultado).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('cae a la apiKey de plataforma si no viene una de opciones', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-plataforma';
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });

      await client.completarConversacion([{ role: 'user', content: 'hola' }]);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'sk-ant-plataforma' }) }),
      );
    });

    it('manda el array de mensajes completo, no un solo prompt', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });
      const mensajes: { role: 'user' | 'assistant'; content: string }[] = [
        { role: 'user', content: 'hola' },
        { role: 'assistant', content: 'hola, en qué te ayudo?' },
        { role: 'user', content: 'cuál es el horario?' },
      ];

      await client.completarConversacion(mensajes);

      const [, opciones] = fetchMock.mock.calls[0];
      const body = JSON.parse(opciones.body as string);
      expect(body.messages).toEqual(mensajes);
    });

    it('devuelve null si Anthropic responde con error', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      const resultado = await client.completarConversacion([{ role: 'user', content: 'hola' }]);

      expect(resultado).toBeNull();
    });

    it('manda opciones.system como campo separado, no como mensaje adentro del array', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });

      await client.completarConversacion([{ role: 'user', content: 'hola' }], { system: 'Sos un asistente' });

      const [, opciones] = fetchMock.mock.calls[0];
      const body = JSON.parse(opciones.body as string);
      expect(body.system).toBe('Sos un asistente');
      expect(body.messages).toEqual([{ role: 'user', content: 'hola' }]);
    });
  });
});
