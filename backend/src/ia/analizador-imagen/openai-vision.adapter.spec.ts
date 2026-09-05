import { ServiceUnavailableException } from '@nestjs/common';
import { OpenAiVisionAdapter } from './openai-vision.adapter';

describe('OpenAiVisionAdapter', () => {
  let adapter: OpenAiVisionAdapter;
  let fetchMock: jest.Mock;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    adapter = new OpenAiVisionAdapter();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    jest.restoreAllMocks();
  });

  it('habilitado refleja OPENAI_API_KEY', () => {
    delete process.env.OPENAI_API_KEY;
    expect(adapter.habilitado).toBe(false);
    process.env.OPENAI_API_KEY = 'sk-oa-1';
    expect(adapter.habilitado).toBe(true);
  });

  it('analizar lanza ServiceUnavailableException sin llamar a fetch si falta la API key', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(adapter.analizar('base64==', 'image/jpeg')).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('manda la imagen como data URI dentro de image_url y devuelve los candidatos parseados', async () => {
    process.env.OPENAI_API_KEY = 'sk-oa-1';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"opciones":[{"nombre":"Zapato","descripcion":"Deportivo."}]}' } }] }),
    });

    const resultado = await adapter.analizar('YmFzZTY0', 'image/png');

    expect(resultado).toEqual([{ nombre: 'Zapato', descripcion: 'Deportivo.' }]);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(opciones.headers.Authorization).toBe('Bearer sk-oa-1');
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.messages[0].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,YmFzZTY0' } });
  });

  it('lanza ServiceUnavailableException si OpenAI responde con error', async () => {
    process.env.OPENAI_API_KEY = 'sk-oa-1';
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
    await expect(adapter.analizar('x', 'image/jpeg')).rejects.toThrow(ServiceUnavailableException);
  });

  it('lanza ServiceUnavailableException si la petición falla', async () => {
    process.env.OPENAI_API_KEY = 'sk-oa-1';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(adapter.analizar('x', 'image/jpeg')).rejects.toThrow(ServiceUnavailableException);
  });
});
