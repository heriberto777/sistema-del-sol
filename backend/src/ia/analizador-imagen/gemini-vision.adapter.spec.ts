import { ServiceUnavailableException } from '@nestjs/common';
import { GeminiVisionAdapter } from './gemini-vision.adapter';

describe('GeminiVisionAdapter', () => {
  let adapter: GeminiVisionAdapter;
  let fetchMock: jest.Mock;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    adapter = new GeminiVisionAdapter();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    jest.restoreAllMocks();
  });

  it('habilitado refleja GEMINI_API_KEY', () => {
    delete process.env.GEMINI_API_KEY;
    expect(adapter.habilitado).toBe(false);
    process.env.GEMINI_API_KEY = 'gm-1';
    expect(adapter.habilitado).toBe(true);
  });

  it('analizar lanza ServiceUnavailableException sin llamar a fetch si falta la API key', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(adapter.analizar('base64==', 'image/jpeg')).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('manda la key como query param y la imagen como inline_data, y devuelve los candidatos parseados', async () => {
    process.env.GEMINI_API_KEY = 'gm-1';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"opciones":[{"nombre":"Yogurt","descripcion":"Sabor fresa."}]}' }] } }] }),
    });

    const resultado = await adapter.analizar('YmFzZTY0', 'image/png');

    expect(resultado).toEqual([{ nombre: 'Yogurt', descripcion: 'Sabor fresa.' }]);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=gm-1');
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.contents[0].parts[1]).toEqual({ inline_data: { mime_type: 'image/png', data: 'YmFzZTY0' } });
  });

  it('lanza ServiceUnavailableException si Gemini responde con error', async () => {
    process.env.GEMINI_API_KEY = 'gm-1';
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
    await expect(adapter.analizar('x', 'image/jpeg')).rejects.toThrow(ServiceUnavailableException);
  });

  it('lanza ServiceUnavailableException si la petición falla', async () => {
    process.env.GEMINI_API_KEY = 'gm-1';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(adapter.analizar('x', 'image/jpeg')).rejects.toThrow(ServiceUnavailableException);
  });
});
