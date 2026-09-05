import { GeminiConversacionAdapter } from './gemini-conversacion.adapter';

describe('GeminiConversacionAdapter', () => {
  let adapter: GeminiConversacionAdapter;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    adapter = new GeminiConversacionAdapter();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('manda la apiKey del tenant como query param y devuelve el texto de la respuesta', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"respuesta":"hola"}' }] } }] }) });

    const resultado = await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'gm-tenant' });

    expect(resultado).toBe('{"respuesta":"hola"}');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=gm-tenant');
  });

  it('mapea el rol "assistant" a "model" (Gemini no usa "assistant")', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) });
    const mensajes: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'en qué te ayudo?' },
    ];

    await adapter.completar(mensajes, { apiKey: 'gm-tenant' });

    const [, opciones] = fetchMock.mock.calls[0];
    const body = JSON.parse(opciones.body);
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'hola' }] },
      { role: 'model', parts: [{ text: 'en qué te ayudo?' }] },
    ]);
  });

  it('manda opciones.system como systemInstruction, no como parte de contents', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) });

    await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'gm-tenant', system: 'Sos un asistente' });

    const [, opciones] = fetchMock.mock.calls[0];
    const body = JSON.parse(opciones.body);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Sos un asistente' }] });
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'hola' }] }]);
  });

  it('devuelve null si Gemini responde con error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const resultado = await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'gm-tenant' });
    expect(resultado).toBeNull();
  });

  it('devuelve null si la petición falla', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const resultado = await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'gm-tenant' });
    expect(resultado).toBeNull();
  });
});
