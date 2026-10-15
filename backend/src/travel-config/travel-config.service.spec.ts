import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { TravelConfigService } from './travel-config.service';
import { TravelConfigRepository } from './travel-config.repository';
import { cifrar } from '../common/utils/encriptado.util';

const CONFIG_VACIA = {
  id: 'tc1',
  tenantId: 't1',
  createdAt: new Date(),
  updatedAt: new Date(),
  duffelApiTokenCifrado: null,
  duffelWebhookSecretCifrado: null,
  hotelbedsApiKeyCifrado: null,
  hotelbedsSecretCifrado: null,
  hotelbedsMoneda: null,
  hotelbedsTasaCambio: null,
};

describe('TravelConfigService', () => {
  let service: TravelConfigService;
  let repo: jest.Mocked<TravelConfigRepository>;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba';
    repo = {
      obtenerOCrear: jest.fn().mockResolvedValue(CONFIG_VACIA),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<TravelConfigRepository>;
    service = new TravelConfigService(repo);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  describe('obtener', () => {
    it('nunca expone un secreto en texto plano — solo si está configurado', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, duffelApiTokenCifrado: cifrar('duffel_test_real') } as never);

      const resultado = await service.obtener('t1');

      expect(resultado.duffelApiTokenConfigurado).toBe(true);
      expect(JSON.stringify(resultado)).not.toContain('duffel_test_real');
    });

    it('reporta configurado:false cuando no hay nada guardado, y hotelbedsMoneda cae a EUR', async () => {
      const resultado = await service.obtener('t1');

      expect(resultado.duffelApiTokenConfigurado).toBe(false);
      expect(resultado.duffelWebhookSecretConfigurado).toBe(false);
      expect(resultado.hotelbedsApiKeyConfigurado).toBe(false);
      expect(resultado.hotelbedsSecretConfigurado).toBe(false);
      expect(resultado.hotelbedsMoneda).toBe('EUR');
      expect(resultado.hotelbedsTasaCambio).toBeNull();
    });

    it('crea la fila con defaults si el tenant no tiene una todavía', async () => {
      await service.obtener('t1');
      expect(repo.obtenerOCrear).toHaveBeenCalledWith('t1');
    });
  });

  describe('actualizar', () => {
    it('cifra un secreto nuevo antes de guardarlo', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { duffelApiToken: 'duffel_test_nuevo' });

      const [, data] = repo.actualizar.mock.calls[0];
      expect((data as { duffelApiTokenCifrado?: string }).duffelApiTokenCifrado).not.toBe('duffel_test_nuevo');
      expect((data as { duffelApiTokenCifrado?: string }).duffelApiTokenCifrado).toEqual(expect.any(String));
    });

    it('"" borra el override guardado (queda null)', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { hotelbedsApiKey: '' });

      const [, data] = repo.actualizar.mock.calls[0];
      expect((data as { hotelbedsApiKeyCifrado?: string | null }).hotelbedsApiKeyCifrado).toBeNull();
    });

    it('omitir un campo no lo toca', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { hotelbedsMoneda: 'USD' });

      const [, data] = repo.actualizar.mock.calls[0];
      expect(data).not.toHaveProperty('duffelApiTokenCifrado');
      expect((data as { hotelbedsMoneda?: string }).hotelbedsMoneda).toBe('USD');
    });

    it('rechaza con 400 si falta ENCRYPTION_KEY al guardar un secreto', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(service.actualizar('t1', { duffelApiToken: 'duffel_test_x' })).rejects.toThrow(BadRequestException);
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('actualiza sobre la fila del tenant correcto', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, id: 'tc-tenant-2' } as never);
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t2', { hotelbedsMoneda: 'DOP' });

      expect(repo.obtenerOCrear).toHaveBeenCalledWith('t2');
      expect(repo.actualizar).toHaveBeenCalledWith('tc-tenant-2', expect.objectContaining({ hotelbedsMoneda: 'DOP' }));
    });
  });

  describe('obtenerCredencialesDuffel', () => {
    it('rechaza con 503 si el tenant no configuró su cuenta de Duffel — sin fallback a ninguna cuenta compartida', async () => {
      await expect(service.obtenerCredencialesDuffel('t1')).rejects.toThrow(ServiceUnavailableException);
    });

    it('descifra y devuelve el token ya guardado', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, duffelApiTokenCifrado: cifrar('duffel_test_real') } as never);

      const credenciales = await service.obtenerCredencialesDuffel('t1');

      expect(credenciales).toEqual({ token: 'duffel_test_real' });
    });
  });

  describe('obtenerCredencialesHotelbeds', () => {
    it('rechaza con 503 si falta el api key o el secret', async () => {
      await expect(service.obtenerCredencialesHotelbeds('t1')).rejects.toThrow(ServiceUnavailableException);

      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, hotelbedsApiKeyCifrado: cifrar('key') } as never);
      await expect(service.obtenerCredencialesHotelbeds('t1')).rejects.toThrow(ServiceUnavailableException);
    });

    it('sin moneda configurada, devuelve EUR con tasa 1', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, hotelbedsApiKeyCifrado: cifrar('key'), hotelbedsSecretCifrado: cifrar('secret') } as never);

      const credenciales = await service.obtenerCredencialesHotelbeds('t1');

      expect(credenciales).toEqual({ apiKey: 'key', secret: 'secret', moneda: 'EUR', tasaCambio: 1 });
    });

    it('con moneda distinta de EUR y tasa configurada, la incluye', async () => {
      repo.obtenerOCrear.mockResolvedValue({
        ...CONFIG_VACIA,
        hotelbedsApiKeyCifrado: cifrar('key'),
        hotelbedsSecretCifrado: cifrar('secret'),
        hotelbedsMoneda: 'USD',
        hotelbedsTasaCambio: 1.08,
      } as never);

      const credenciales = await service.obtenerCredencialesHotelbeds('t1');

      expect(credenciales).toEqual({ apiKey: 'key', secret: 'secret', moneda: 'USD', tasaCambio: 1.08 });
    });

    it('con moneda distinta de EUR pero sin tasa configurada, cae a tasa 1 (fallback seguro)', async () => {
      repo.obtenerOCrear.mockResolvedValue({
        ...CONFIG_VACIA,
        hotelbedsApiKeyCifrado: cifrar('key'),
        hotelbedsSecretCifrado: cifrar('secret'),
        hotelbedsMoneda: 'USD',
        hotelbedsTasaCambio: null,
      } as never);

      const credenciales = await service.obtenerCredencialesHotelbeds('t1');

      expect(credenciales.tasaCambio).toBe(1);
    });
  });
});
