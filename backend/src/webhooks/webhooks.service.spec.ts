import { BadRequestException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksRepository } from './webhooks.repository';
import * as ssrfGuard from './ssrf-guard';

jest.mock('./ssrf-guard');

describe('WebhooksService — reintento de entrega', () => {
  let service: WebhooksService;
  let repository: jest.Mocked<WebhooksRepository>;
  let fetchMock: jest.Mock;

  const webhook = { id: 'w1', url: 'https://ejemplo.test/hook', secret: 'shh', eventos: ['factura.creada'] };

  beforeEach(() => {
    jest.useFakeTimers();
    repository = {
      buscarActivosPorEvento: jest.fn().mockResolvedValue([webhook]),
      registrarEntrega: jest.fn(),
    } as unknown as jest.Mocked<WebhooksRepository>;
    service = new WebhooksService(repository);
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
    // El servicio revalida con el SSRF guard en cada intento de entrega (no
    // solo al crear el webhook) — por defecto lo dejamos pasar para poder
    // probar la lógica de reintento/backoff de forma aislada.
    (ssrfGuard.validarUrlWebhook as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('no reintenta si el primer intento responde 2xx', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const promesa = service.alFacturarse({ tenantId: 't1' });
    await jest.advanceTimersByTimeAsync(15_000);
    await promesa;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(repository.registrarEntrega).toHaveBeenCalledWith('w1', 'factura.creada', { tenantId: 't1' }, 200, true, 1);
  });

  it('reintenta con backoff y tiene éxito en el segundo intento', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce({ ok: true, status: 200 });

    const promesa = service.alFacturarse({ tenantId: 't1' });
    await jest.advanceTimersByTimeAsync(15_000);
    await promesa;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(repository.registrarEntrega).toHaveBeenCalledWith('w1', 'factura.creada', { tenantId: 't1' }, 200, true, 2);
  });

  it('agota los 3 intentos y registra el fallo definitivo', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    const promesa = service.alFacturarse({ tenantId: 't1' });
    await jest.advanceTimersByTimeAsync(15_000);
    await promesa;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(repository.registrarEntrega).toHaveBeenCalledWith('w1', 'factura.creada', { tenantId: 't1' }, null, false, 3);
  });

  it('registra el último statusCode visto aunque termine fallando', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const promesa = service.alFacturarse({ tenantId: 't1' });
    await jest.advanceTimersByTimeAsync(15_000);
    await promesa;

    expect(repository.registrarEntrega).toHaveBeenCalledWith('w1', 'factura.creada', { tenantId: 't1' }, 500, false, 3);
  });

  it('no despacha nada si no hay webhooks activos para el evento', async () => {
    repository.buscarActivosPorEvento.mockResolvedValue([]);

    await service.alFacturarse({ tenantId: 't1' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(repository.registrarEntrega).not.toHaveBeenCalled();
  });

  it('bloquea la entrega (sin llamar fetch, sin reintentar) si el SSRF guard rechaza la URL al momento de entregar', async () => {
    // Escenario de DNS rebinding: el host pasó la validación al crear el
    // webhook pero para cuando toca entregar, resuelve a una IP privada.
    (ssrfGuard.validarUrlWebhook as jest.Mock).mockRejectedValue(new Error('No se permite una IP privada/interna como destino de webhook'));

    const promesa = service.alFacturarse({ tenantId: 't1' });
    await jest.advanceTimersByTimeAsync(15_000);
    await promesa;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(repository.registrarEntrega).toHaveBeenCalledWith('w1', 'factura.creada', { tenantId: 't1' }, null, false, 1);
  });
});

describe('WebhooksService — crear', () => {
  let service: WebhooksService;
  let repository: jest.Mocked<WebhooksRepository>;

  beforeEach(() => {
    jest.restoreAllMocks();
    repository = { crear: jest.fn() } as unknown as jest.Mocked<WebhooksRepository>;
    service = new WebhooksService(repository);
  });

  it('convierte el error de validarUrlWebhook en un 400 claro en vez de dejarlo como 500 (regresión: antes new URL() con una cadena inválida tumbaba como 500)', async () => {
    jest.spyOn(ssrfGuard, 'validarUrlWebhook').mockRejectedValue(new TypeError('Invalid URL'));

    await expect(service.crear({ url: 'no-es-una-url', eventos: ['factura.creada'] }, 'tenant-1')).rejects.toThrow(BadRequestException);
    expect(repository.crear).not.toHaveBeenCalled();
  });

  it('crea el webhook con un secret generado cuando la URL es válida', async () => {
    jest.spyOn(ssrfGuard, 'validarUrlWebhook').mockResolvedValue(undefined);
    repository.crear.mockResolvedValue({ id: 'w1' } as never);

    await service.crear({ url: 'https://example.com/hook', eventos: ['factura.creada'] }, 'tenant-1');

    expect(repository.crear).toHaveBeenCalledWith('https://example.com/hook', ['factura.creada'], expect.any(String), 'tenant-1');
  });
});

describe('WebhooksService — listarEntregas', () => {
  let service: WebhooksService;
  let repository: jest.Mocked<WebhooksRepository>;

  beforeEach(() => {
    repository = {
      buscarPorId: jest.fn(),
      listarEntregas: jest.fn(),
    } as unknown as jest.Mocked<WebhooksRepository>;
    service = new WebhooksService(repository);
  });

  it('valida que el webhook pertenezca al tenant antes de listar sus entregas', async () => {
    repository.buscarPorId.mockResolvedValue({ id: 'w1' } as never);
    repository.listarEntregas.mockResolvedValue([{ id: 'd1' }] as never);

    const resultado = await service.listarEntregas('w1');

    expect(repository.buscarPorId).toHaveBeenCalledWith('w1');
    expect(repository.listarEntregas).toHaveBeenCalledWith('w1');
    expect(resultado).toEqual([{ id: 'd1' }]);
  });

  it('propaga el error si el webhook no existe/no pertenece al tenant (404 vía findUniqueOrThrow)', async () => {
    repository.buscarPorId.mockRejectedValue(new Error('no encontrado'));

    await expect(service.listarEntregas('w1')).rejects.toThrow('no encontrado');
    expect(repository.listarEntregas).not.toHaveBeenCalled();
  });
});
