import { OpenAiConversacionAdapter } from './openai-conversacion.adapter';

describe('OpenAiConversacionAdapter', () => {
  let adapter: OpenAiConversacionAdapter;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    adapter = new OpenAiConversacionAdapter();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('manda la apiKey del tenant como Bearer y devuelve el texto de la respuesta', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"respuesta":"hola"}' } }] }) });

    const resultado = await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'sk-oa-tenant' });

    expect(resultado).toBe('{"respuesta":"hola"}');
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(opciones.headers.Authorization).toBe('Bearer sk-oa-tenant');
  });

  it('antepone opciones.system como mensaje role "system" dentro del mismo array', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) });

    await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'sk-oa-tenant', system: 'Sos un asistente' });

    const [, opciones] = fetchMock.mock.calls[0];
    const body = JSON.parse(opciones.body);
    expect(body.messages).toEqual([{ role: 'system', content: 'Sos un asistente' }, { role: 'user', content: 'hola' }]);
  });

  it('sin system, no agrega ningún mensaje extra', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) });

    await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'sk-oa-tenant' });

    const [, opciones] = fetchMock.mock.calls[0];
    expect(JSON.parse(opciones.body).messages).toEqual([{ role: 'user', content: 'hola' }]);
  });

  it('devuelve null si OpenAI responde con error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const resultado = await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'sk-oa-tenant' });
    expect(resultado).toBeNull();
  });

  it('devuelve null si la petición falla', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const resultado = await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'sk-oa-tenant' });
    expect(resultado).toBeNull();
  });
});
