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
  duffelApiTokenCifrado: null,
  duffelWebhookSecretCifrado: null,
  hotelbedsApiKeyCifrado: null,
  hotelbedsSecretCifrado: null,
  hotelbedsMoneda: null,
  hotelbedsTasaCambio: null,
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
      expect(resultado.travel.duffelApiTokenConfigurado).toBe(false);
    });

    it('travel — reporta configurado:true sin exponer el token en texto plano', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, duffelApiTokenCifrado: cifrar('duffel_test_real') } as never);

      const resultado = await service.obtener();

      expect(resultado.travel.duffelApiTokenConfigurado).toBe(true);
      expect(JSON.stringify(resultado)).not.toContain('duffel_test_real');
    });

    it('travel — reporta duffelWebhookSecretConfigurado:true sin exponer el secreto en texto plano', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, duffelWebhookSecretCifrado: cifrar('whsec_duffel_real') } as never);

      const resultado = await service.obtener();

      expect(resultado.travel.duffelWebhookSecretConfigurado).toBe(true);
      expect(JSON.stringify(resultado)).not.toContain('whsec_duffel_real');
    });

    it('travel — reporta hotelbedsApiKeyConfigurado/hotelbedsSecretConfigurado:true sin exponerlos en texto plano', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, hotelbedsApiKeyCifrado: cifrar('hb_key_real'), hotelbedsSecretCifrado: cifrar('hb_secret_real') } as never);

      const resultado = await service.obtener();

      expect(resultado.travel.hotelbedsApiKeyConfigurado).toBe(true);
      expect(resultado.travel.hotelbedsSecretConfigurado).toBe(true);
      expect(JSON.stringify(resultado)).not.toContain('hb_key_real');
      expect(JSON.stringify(resultado)).not.toContain('hb_secret_real');
    });

    it('travel — hotelbedsMoneda por defecto es EUR y hotelbedsTasaCambio null (sin conversión configurada)', async () => {
      const resultado = await service.obtener();
      expect(resultado.travel.hotelbedsMoneda).toBe('EUR');
      expect(resultado.travel.hotelbedsTasaCambio).toBeNull();
    });

    it('travel — expone hotelbedsMoneda/hotelbedsTasaCambio guardados (no son secretos, van en claro)', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, hotelbedsMoneda: 'USD', hotelbedsTasaCambio: 1.08 } as never);

      const resultado = await service.obtener();

      expect(resultado.travel.hotelbedsMoneda).toBe('USD');
      expect(resultado.travel.hotelbedsTasaCambio).toBe(1.08);
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

    it('travel — sincroniza el token descifrado a DUFFEL_API_TOKEN (lo que lee DuffelAdapter)', async () => {
      delete process.env.DUFFEL_API_TOKEN;
      repo.actualizar.mockResolvedValue({ ...CONFIG_VACIA, duffelApiTokenCifrado: cifrar('duffel_test_real') } as never);

      await service.actualizar({ duffelApiToken: 'duffel_test_real' } as never);

      expect(process.env.DUFFEL_API_TOKEN).toBe('duffel_test_real');
    });

    it('travel — sincroniza el secreto descifrado a DUFFEL_WEBHOOK_SECRET (lo que lee TravelWebhookController)', async () => {
      delete process.env.DUFFEL_WEBHOOK_SECRET;
      repo.actualizar.mockResolvedValue({ ...CONFIG_VACIA, duffelWebhookSecretCifrado: cifrar('whsec_duffel_real') } as never);

      await service.actualizar({ duffelWebhookSecret: 'whsec_duffel_real' } as never);

      expect(process.env.DUFFEL_WEBHOOK_SECRET).toBe('whsec_duffel_real');
    });

    it('travel — sincroniza las credenciales de Hotelbeds descifradas a HOTELBEDS_API_KEY/HOTELBEDS_SECRET (lo que lee HotelbedsAdapter)', async () => {
      delete process.env.HOTELBEDS_API_KEY;
      delete process.env.HOTELBEDS_SECRET;
      repo.actualizar.mockResolvedValue({ ...CONFIG_VACIA, hotelbedsApiKeyCifrado: cifrar('hb_key_real'), hotelbedsSecretCifrado: cifrar('hb_secret_real') } as never);

      await service.actualizar({ hotelbedsApiKey: 'hb_key_real', hotelbedsSecret: 'hb_secret_real' } as never);

      expect(process.env.HOTELBEDS_API_KEY).toBe('hb_key_real');
      expect(process.env.HOTELBEDS_SECRET).toBe('hb_secret_real');
    });

    it('travel — sincroniza hotelbedsMoneda/hotelbedsTasaCambio a HOTELBEDS_MONEDA/HOTELBEDS_TASA_CAMBIO (lo que lee HotelbedsAdapter)', async () => {
      delete process.env.HOTELBEDS_MONEDA;
      delete process.env.HOTELBEDS_TASA_CAMBIO;
      repo.actualizar.mockResolvedValue({ ...CONFIG_VACIA, hotelbedsMoneda: 'USD', hotelbedsTasaCambio: 1.08 } as never);

      await service.actualizar({ hotelbedsMoneda: 'USD', hotelbedsTasaCambio: 1.08 } as never);

      expect(process.env.HOTELBEDS_MONEDA).toBe('USD');
      expect(process.env.HOTELBEDS_TASA_CAMBIO).toBe('1.08');
    });

    it('el modelo elegido por proveedor se guarda y se sincroniza a su variable de entorno', async () => {
      delete process.env.ANTHROPIC_MODEL;
      repo.actualizar.mockResolvedValue({ ...CONFIG_VACIA, iaClaudeModelo: 'claude-haiku-4-5' } as never);

      await service.actualizar({ iaClaudeModelo: 'claude-haiku-4-5' } as never);

      const [, data] = repo.actualizar.mock.calls[0];
      expect((data as { iaClaudeModelo?: string }).iaClaudeModelo).toBe('claude-haiku-4-5');
      expect(process.env.ANTHROPIC_MODEL).toBe('claude-haiku-4-5');
    });
  });

  describe('obtener — iaImagen', () => {
    it('expone el modelo elegido por proveedor (no es secreto)', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, iaClaudeModelo: 'claude-sonnet-5', iaOpenaiModelo: 'gpt-4o', iaGeminiModelo: 'gemini-2.0-flash' } as never);

      const resultado = await service.obtener();

      expect(resultado.iaImagen.claudeModelo).toBe('claude-sonnet-5');
      expect(resultado.iaImagen.openaiModelo).toBe('gpt-4o');
      expect(resultado.iaImagen.geminiModelo).toBe('gemini-2.0-flash');
    });
  });
});
