import { BadRequestException } from '@nestjs/common';
import { PlataformaConfigService } from './plataforma-config.service';
import { PlataformaConfigRepository } from './plataforma-config.repository';
import { cifrar } from '../common/utils/encriptado.util';

const CONFIG_VACIA = {
  id: 'c1',
  createdAt: new Date(),
  updatedAt: new Date(),
  nombreNegocio: null,
  emailHabilitado: null,
  smtpHost: null,
  smtpPort: null,
  smtpUser: null,
  smtpPasswordCifrado: null,
  smtpFrom: null,
  twilioAccountSid: null,
  twilioAuthTokenCifrado: null,
  twilioWhatsappFrom: null,
  pasarelaActiva: null,
  stripeSecretKeyCifrado: null,
  stripeWebhookSecretCifrado: null,
  stripeCurrency: null,
  webhookUrl: null,
  webhookSecretCifrado: null,
  webhookActivo: false,
};

describe('PlataformaConfigService', () => {
  let service: PlataformaConfigService;
  let repo: jest.Mocked<PlataformaConfigRepository>;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba';
    repo = {
      obtenerOCrear: jest.fn().mockResolvedValue(CONFIG_VACIA),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<PlataformaConfigRepository>;
    service = new PlataformaConfigService(repo);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  describe('obtener', () => {
    it('nunca expone un secreto en texto plano — solo si está configurado', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, stripeSecretKeyCifrado: cifrar('sk_test_real') } as never);

      const resultado = await service.obtener();

      expect(resultado.pasarela.stripeSecretKeyConfigurado).toBe(true);
      expect(JSON.stringify(resultado)).not.toContain('sk_test_real');
    });

    it('reporta configurado:false cuando no hay nada guardado', async () => {
      const resultado = await service.obtener();
      expect(resultado.pasarela.stripeSecretKeyConfigurado).toBe(false);
      expect(resultado.notificaciones.email.passwordConfigurado).toBe(false);
    });
  });

  describe('actualizar', () => {
    it('cifra un secreto nuevo antes de guardarlo', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar({ stripeSecretKey: 'sk_test_nuevo' } as never);

      const [, data] = repo.actualizar.mock.calls[0];
      expect((data as { stripeSecretKeyCifrado?: string }).stripeSecretKeyCifrado).not.toBe('sk_test_nuevo');
      expect((data as { stripeSecretKeyCifrado?: string }).stripeSecretKeyCifrado).toEqual(expect.any(String));
    });

    it('"" borra el override guardado (queda null)', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar({ stripeSecretKey: '' } as never);

      const [, data] = repo.actualizar.mock.calls[0];
      expect((data as { stripeSecretKeyCifrado?: string | null }).stripeSecretKeyCifrado).toBeNull();
    });

    it('omitir un campo no lo toca', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar({ nombreNegocio: 'Mi Negocio' } as never);

      const [, data] = repo.actualizar.mock.calls[0];
      expect(data).not.toHaveProperty('stripeSecretKeyCifrado');
      expect((data as { nombreNegocio?: string }).nombreNegocio).toBe('Mi Negocio');
    });

    it('rechaza con 400 si falta ENCRYPTION_KEY al guardar un secreto', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(service.actualizar({ stripeSecretKey: 'sk_test_x' } as never)).rejects.toThrow(BadRequestException);
      expect(repo.actualizar).not.toHaveBeenCalled();
    });
  });

  describe('sincronizarEnv (vía actualizar/onModuleInit)', () => {
    it('solo pisa process.env para campos no-nulos de la config', async () => {
      delete process.env.STRIPE_CURRENCY;
      delete process.env.SMTP_HOST;
      repo.actualizar.mockResolvedValue({ ...CONFIG_VACIA, stripeCurrency: 'usd' } as never);

      await service.actualizar({ stripeCurrency: 'usd' } as never);

      expect(process.env.STRIPE_CURRENCY).toBe('usd');
      expect(process.env.SMTP_HOST).toBeUndefined();
    });

    it('onModuleInit sincroniza process.env con lo ya guardado en la base', async () => {
      delete process.env.PASARELA_PAGO_ACTIVA;
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, pasarelaActiva: 'stripe' } as never);

      await service.onModuleInit();

      expect(process.env.PASARELA_PAGO_ACTIVA).toBe('stripe');
    });
  });
});
