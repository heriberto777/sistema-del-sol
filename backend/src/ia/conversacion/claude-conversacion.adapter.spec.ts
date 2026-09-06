import { ServiceUnavailableException } from '@nestjs/common';
import { ClaudeConversacionAdapter } from './claude-conversacion.adapter';

describe('ClaudeConversacionAdapter', () => {
  let adapter: ClaudeConversacionAdapter;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    adapter = new ClaudeConversacionAdapter();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('manda la apiKey del tenant como x-api-key y devuelve el texto de la respuesta', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: '{"respuesta":"hola"}' }] }) });

    const resultado = await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'sk-ant-tenant' });

    expect(resultado).toBe('{"respuesta":"hola"}');
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opciones.headers['x-api-key']).toBe('sk-ant-tenant');
  });

  it('manda el array de mensajes completo, no un solo prompt', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });
    const mensajes: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'hola, en qué te ayudo?' },
      { role: 'user', content: 'cuál es el horario?' },
    ];

    await adapter.completar(mensajes, { apiKey: 'sk-ant-tenant' });

    const [, opciones] = fetchMock.mock.calls[0];
    expect(JSON.parse(opciones.body).messages).toEqual(mensajes);
  });

  it('manda opciones.system como campo separado, no como mensaje adentro del array', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });

    await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'sk-ant-tenant', system: 'Sos un asistente' });

    const [, opciones] = fetchMock.mock.calls[0];
    const body = JSON.parse(opciones.body);
    expect(body.system).toBe('Sos un asistente');
    expect(body.messages).toEqual([{ role: 'user', content: 'hola' }]);
  });

  it('devuelve null si Anthropic responde con error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const resultado = await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'sk-ant-tenant' });
    expect(resultado).toBeNull();
  });

  it('devuelve null si la petición falla', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const resultado = await adapter.completar([{ role: 'user', content: 'hola' }], { apiKey: 'sk-ant-tenant' });
    expect(resultado).toBeNull();
  });

  describe('listarModelos', () => {
    it('consulta GET /v1/models con la apiKey del tenant y devuelve id + display_name', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'claude-sonnet-5', display_name: 'Claude Sonnet 5' }, { id: 'claude-haiku-4-5' }] }),
      });

      const resultado = await adapter.listarModelos('sk-ant-tenant');

      expect(resultado).toEqual([
        { id: 'claude-sonnet-5', nombre: 'Claude Sonnet 5' },
        { id: 'claude-haiku-4-5', nombre: 'claude-haiku-4-5' },
      ]);
      const [url, opciones] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/models?limit=100');
      expect(opciones.headers['x-api-key']).toBe('sk-ant-tenant');
    });

    it('lanza ServiceUnavailableException si Anthropic responde con error', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
      await expect(adapter.listarModelos('sk-ant-tenant')).rejects.toThrow(ServiceUnavailableException);
    });

    it('lanza ServiceUnavailableException si la petición falla', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));
      await expect(adapter.listarModelos('sk-ant-tenant')).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
