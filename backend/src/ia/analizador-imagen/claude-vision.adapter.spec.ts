import { ServiceUnavailableException } from '@nestjs/common';
import { ClaudeVisionAdapter } from './claude-vision.adapter';

describe('ClaudeVisionAdapter', () => {
  let adapter: ClaudeVisionAdapter;
  let fetchMock: jest.Mock;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    adapter = new ClaudeVisionAdapter();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    jest.restoreAllMocks();
  });

  it('habilitado refleja ANTHROPIC_API_KEY', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(adapter.habilitado).toBe(false);
    process.env.ANTHROPIC_API_KEY = 'sk-ant-1';
    expect(adapter.habilitado).toBe(true);
  });

  it('analizar lanza ServiceUnavailableException sin llamar a fetch si falta la API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(adapter.analizar('base64==', 'image/jpeg')).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('manda la imagen como bloque image+text y devuelve los candidatos parseados', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-1';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"opciones":[{"nombre":"Camisa azul","descripcion":"Manga larga."}]}' }] }),
    });

    const resultado = await adapter.analizar('YmFzZTY0', 'image/png');

    expect(resultado).toEqual([{ nombre: 'Camisa azul', descripcion: 'Manga larga.' }]);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opciones.headers['x-api-key']).toBe('sk-ant-1');
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'YmFzZTY0' } });
  });

  it('lanza ServiceUnavailableException si Anthropic responde con error', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-1';
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
    await expect(adapter.analizar('x', 'image/jpeg')).rejects.toThrow(ServiceUnavailableException);
  });

  it('incluye el detalle del admin en el bloque de texto cuando se pasa uno', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-1';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"opciones":[{"nombre":"X","descripcion":"Y"}]}' }] }),
    });

    await adapter.analizar('YmFzZTY0', 'image/png', 'Es de cuero genuino, talla 42');

    const [, opciones] = fetchMock.mock.calls[0];
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.messages[0].content[1].text).toContain('Es de cuero genuino, talla 42');
  });

  it('lanza ServiceUnavailableException si la petición falla', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-1';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(adapter.analizar('x', 'image/jpeg')).rejects.toThrow(ServiceUnavailableException);
  });

  describe('listarModelos', () => {
    it('lanza ServiceUnavailableException sin llamar a fetch si falta la API key', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      await expect(adapter.listarModelos()).rejects.toThrow(ServiceUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('consulta GET /v1/models y devuelve id + display_name', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-1';
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'claude-sonnet-5', display_name: 'Claude Sonnet 5' }, { id: 'claude-haiku-4-5' }] }),
      });

      const resultado = await adapter.listarModelos();

      expect(resultado).toEqual([
        { id: 'claude-sonnet-5', nombre: 'Claude Sonnet 5' },
        { id: 'claude-haiku-4-5', nombre: 'claude-haiku-4-5' },
      ]);
      const [url, opciones] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/models?limit=100');
      expect(opciones.headers['x-api-key']).toBe('sk-ant-1');
    });

    it('lanza ServiceUnavailableException si Anthropic responde con error', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-1';
      fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
      await expect(adapter.listarModelos()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
