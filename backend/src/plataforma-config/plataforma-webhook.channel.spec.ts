import { PlataformaWebhookChannel } from './plataforma-webhook.channel';
import { PlataformaConfigRepository } from './plataforma-config.repository';

describe('PlataformaWebhookChannel', () => {
  let channel: PlataformaWebhookChannel;
  let repository: jest.Mocked<PlataformaConfigRepository>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    repository = { obtenerOCrear: jest.fn() } as unknown as jest.Mocked<PlataformaConfigRepository>;
    channel = new PlataformaWebhookChannel(repository);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('no envía nada si el webhook no está activo', async () => {
    repository.obtenerOCrear.mockResolvedValue({ webhookActivo: false, webhookUrl: 'https://ejemplo.com/hook' } as never);

    const resultado = await channel.enviar({ evento: 'x' });

    expect(resultado).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no envía nada si no hay URL configurada, aunque esté activo', async () => {
    repository.obtenerOCrear.mockResolvedValue({ webhookActivo: true, webhookUrl: null } as never);

    const resultado = await channel.enviar({ evento: 'x' });

    expect(resultado).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza una URL que apunta a infraestructura interna (SSRF guard) sin llamar fetch', async () => {
    repository.obtenerOCrear.mockResolvedValue({ webhookActivo: true, webhookUrl: 'http://127.0.0.1/hook', webhookSecretCifrado: null } as never);

    const resultado = await channel.enviar({ evento: 'x' });

    expect(resultado).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hace POST con el payload y devuelve true si la respuesta es ok', async () => {
    repository.obtenerOCrear.mockResolvedValue({ webhookActivo: true, webhookUrl: 'https://ejemplo.com/hook', webhookSecretCifrado: null } as never);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const resultado = await channel.enviar({ facturaId: 'f1' });

    expect(resultado).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ejemplo.com/hook',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }),
    );
    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cuerpo.facturaId).toBe('f1');
  });

  it('devuelve false si el destino responde con error', async () => {
    repository.obtenerOCrear.mockResolvedValue({ webhookActivo: true, webhookUrl: 'https://ejemplo.com/hook', webhookSecretCifrado: null } as never);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const resultado = await channel.enviar({ evento: 'x' });

    expect(resultado).toBe(false);
  });

  it('devuelve false si fetch lanza (destino inalcanzable)', async () => {
    repository.obtenerOCrear.mockResolvedValue({ webhookActivo: true, webhookUrl: 'https://ejemplo.com/hook', webhookSecretCifrado: null } as never);
    fetchMock.mockRejectedValue(new Error('network error'));

    const resultado = await channel.enviar({ evento: 'x' });

    expect(resultado).toBe(false);
  });
});
