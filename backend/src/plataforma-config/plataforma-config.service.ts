import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PlataformaConfiguracion } from '@prisma/client';
import { PlataformaConfigRepository } from './plataforma-config.repository';
import { ActualizarPlataformaConfigDto } from './dto/actualizar-plataforma-config.dto';
import { cifrar, descifrar } from '../common/utils/encriptado.util';

/**
 * En vez de que cada canal (EmailChannel/WhatsAppChannel/StripeAdapter)
 * dependa de este servicio, `sincronizarEnv()` escribe los valores
 * guardados directo en `process.env` — los canales ya leen `process.env`
 * fresco en cada llamada (o, en el caso de EmailChannel, se ajustó para
 * hacerlo — ver email.channel.ts), así que un cambio acá aplica sin
 * reiniciar el backend y sin tocarles una sola línea de más.
 */
@Injectable()
export class PlataformaConfigService implements OnModuleInit {
  constructor(private readonly repository: PlataformaConfigRepository) {}

  async onModuleInit() {
    const config = await this.repository.obtenerOCrear();
    this.sincronizarEnv(config);
  }

  async obtener() {
    const config = await this.repository.obtenerOCrear();
    return this.aFormaSegura(config);
  }

  /** Sin sesión (Login, antes de resolver tenant) — a propósito solo el logo, nunca el resto de PlataformaConfiguracion (RNC, SMTP, etc. sí son sensibles). */
  async obtenerPublica() {
    const config = await this.repository.obtenerOCrear();
    return { logo: config.logo };
  }

  async actualizar(dto: ActualizarPlataformaConfigDto) {
    const config = await this.repository.obtenerOCrear();
    const data: Prisma.PlataformaConfiguracionUpdateInput = {};

    if (dto.nombreNegocio !== undefined) data.nombreNegocio = dto.nombreNegocio;
    if (dto.logo !== undefined) data.logo = dto.logo;
    if (dto.rnc !== undefined) data.rnc = dto.rnc;
    if (dto.direccion !== undefined) data.direccion = dto.direccion;
    if (dto.telefono !== undefined) data.telefono = dto.telefono;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.modalidadFacturacion !== undefined) data.modalidadFacturacion = dto.modalidadFacturacion;
    if (dto.porcentajeItbis !== undefined) data.porcentajeItbis = dto.porcentajeItbis;
    if (dto.emailHabilitado !== undefined) data.emailHabilitado = dto.emailHabilitado;
    if (dto.smtpHost !== undefined) data.smtpHost = dto.smtpHost;
    if (dto.smtpPort !== undefined) data.smtpPort = dto.smtpPort;
    if (dto.smtpUser !== undefined) data.smtpUser = dto.smtpUser;
    if (dto.smtpFrom !== undefined) data.smtpFrom = dto.smtpFrom;
    if (dto.twilioAccountSid !== undefined) data.twilioAccountSid = dto.twilioAccountSid;
    if (dto.twilioWhatsappFrom !== undefined) data.twilioWhatsappFrom = dto.twilioWhatsappFrom;
    if (dto.pasarelaActiva !== undefined) data.pasarelaActiva = dto.pasarelaActiva;
    if (dto.stripeCurrency !== undefined) data.stripeCurrency = dto.stripeCurrency;
    if (dto.webhookUrl !== undefined) data.webhookUrl = dto.webhookUrl;
    if (dto.webhookActivo !== undefined) data.webhookActivo = dto.webhookActivo;
    if (dto.diasParaAutoSuspender !== undefined) data.diasParaAutoSuspender = dto.diasParaAutoSuspender;
    if (dto.npmBaseUrl !== undefined) data.npmBaseUrl = dto.npmBaseUrl;
    if (dto.npmUsuario !== undefined) data.npmUsuario = dto.npmUsuario;
    if (dto.npmForwardHost !== undefined) data.npmForwardHost = dto.npmForwardHost;
    if (dto.npmForwardPort !== undefined) data.npmForwardPort = dto.npmForwardPort;
    if (dto.npmPublicHost !== undefined) data.npmPublicHost = dto.npmPublicHost;
    if (dto.iaImagenProveedorActivo !== undefined) data.iaImagenProveedorActivo = dto.iaImagenProveedorActivo;

    this.aplicarCampoSecreto(data, 'smtpPasswordCifrado', dto.smtpPassword);
    this.aplicarCampoSecreto(data, 'twilioAuthTokenCifrado', dto.twilioAuthToken);
    this.aplicarCampoSecreto(data, 'stripeSecretKeyCifrado', dto.stripeSecretKey);
    this.aplicarCampoSecreto(data, 'stripeWebhookSecretCifrado', dto.stripeWebhookSecret);
    this.aplicarCampoSecreto(data, 'webhookSecretCifrado', dto.webhookSecret);
    this.aplicarCampoSecreto(data, 'npmPasswordCifrado', dto.npmPassword);
    this.aplicarCampoSecreto(data, 'iaClaudeApiKeyCifrado', dto.iaClaudeApiKey);
    this.aplicarCampoSecreto(data, 'iaOpenaiApiKeyCifrado', dto.iaOpenaiApiKey);
    this.aplicarCampoSecreto(data, 'iaGeminiApiKeyCifrado', dto.iaGeminiApiKey);

    const actualizado = await this.repository.actualizar(config.id, data);
    this.sincronizarEnv(actualizado);
    return this.aFormaSegura(actualizado);
  }

  /** valor undefined = sin cambios; "" = borra el override (vuelve a .env); string no vacío = cifra y guarda. */
  private aplicarCampoSecreto(data: Prisma.PlataformaConfiguracionUpdateInput, campo: string, valor: string | undefined) {
    if (valor === undefined) return;
    if (valor === '') {
      (data as Record<string, unknown>)[campo] = null;
      return;
    }
    try {
      (data as Record<string, unknown>)[campo] = cifrar(valor);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  private sincronizarEnv(config: PlataformaConfiguracion) {
    if (config.emailHabilitado !== null) process.env.EMAIL_HABILITADO = String(config.emailHabilitado);
    if (config.smtpHost) process.env.SMTP_HOST = config.smtpHost;
    if (config.smtpPort !== null) process.env.SMTP_PORT = String(config.smtpPort);
    if (config.smtpUser) process.env.SMTP_USER = config.smtpUser;
    if (config.smtpPasswordCifrado) process.env.SMTP_PASSWORD = descifrar(config.smtpPasswordCifrado);
    if (config.smtpFrom) process.env.SMTP_FROM = config.smtpFrom;

    if (config.twilioAccountSid) process.env.TWILIO_ACCOUNT_SID = config.twilioAccountSid;
    if (config.twilioAuthTokenCifrado) process.env.TWILIO_AUTH_TOKEN = descifrar(config.twilioAuthTokenCifrado);
    if (config.twilioWhatsappFrom) process.env.TWILIO_WHATSAPP_FROM = config.twilioWhatsappFrom;

    if (config.pasarelaActiva) process.env.PASARELA_PAGO_ACTIVA = config.pasarelaActiva;
    if (config.stripeSecretKeyCifrado) process.env.STRIPE_SECRET_KEY = descifrar(config.stripeSecretKeyCifrado);
    if (config.stripeWebhookSecretCifrado) process.env.STRIPE_WEBHOOK_SECRET = descifrar(config.stripeWebhookSecretCifrado);
    if (config.stripeCurrency) process.env.STRIPE_CURRENCY = config.stripeCurrency;

    if (config.iaImagenProveedorActivo) process.env.IA_IMAGEN_PROVEEDOR_ACTIVO = config.iaImagenProveedorActivo;
    // `ANTHROPIC_API_KEY` es la MISMA variable que ya lee IaClientService
    // (bot de WhatsApp) — configurarla acá no crea una credencial nueva.
    if (config.iaClaudeApiKeyCifrado) process.env.ANTHROPIC_API_KEY = descifrar(config.iaClaudeApiKeyCifrado);
    if (config.iaOpenaiApiKeyCifrado) process.env.OPENAI_API_KEY = descifrar(config.iaOpenaiApiKeyCifrado);
    if (config.iaGeminiApiKeyCifrado) process.env.GEMINI_API_KEY = descifrar(config.iaGeminiApiKeyCifrado);
  }

  /** Nunca expone un secreto en texto plano — solo si hay uno guardado (*Configurado). */
  private aFormaSegura(config: PlataformaConfiguracion) {
    return {
      general: {
        nombreNegocio: config.nombreNegocio,
        logo: config.logo,
        rnc: config.rnc,
        direccion: config.direccion,
        telefono: config.telefono,
        email: config.email,
        modalidadFacturacion: config.modalidadFacturacion,
        porcentajeItbis: Number(config.porcentajeItbis),
      },
      notificaciones: {
        email: {
          habilitado: config.emailHabilitado,
          host: config.smtpHost,
          port: config.smtpPort,
          user: config.smtpUser,
          passwordConfigurado: Boolean(config.smtpPasswordCifrado),
          from: config.smtpFrom,
        },
        whatsapp: {
          accountSid: config.twilioAccountSid,
          authTokenConfigurado: Boolean(config.twilioAuthTokenCifrado),
          from: config.twilioWhatsappFrom,
        },
      },
      pasarela: {
        activa: config.pasarelaActiva,
        currency: config.stripeCurrency,
        stripeSecretKeyConfigurado: Boolean(config.stripeSecretKeyCifrado),
        stripeWebhookSecretConfigurado: Boolean(config.stripeWebhookSecretCifrado),
      },
      webhook: {
        url: config.webhookUrl,
        activo: config.webhookActivo,
        secretConfigurado: Boolean(config.webhookSecretCifrado),
      },
      autoSuspension: {
        diasParaAutoSuspender: config.diasParaAutoSuspender,
      },
      dominioPropio: {
        npmBaseUrl: config.npmBaseUrl,
        npmUsuario: config.npmUsuario,
        npmPasswordConfigurado: Boolean(config.npmPasswordCifrado),
        npmForwardHost: config.npmForwardHost,
        npmForwardPort: config.npmForwardPort,
        npmPublicHost: config.npmPublicHost,
      },
      iaImagen: {
        proveedorActivo: config.iaImagenProveedorActivo,
        claudeApiKeyConfigurado: Boolean(config.iaClaudeApiKeyCifrado),
        openaiApiKeyConfigurado: Boolean(config.iaOpenaiApiKeyCifrado),
        geminiApiKeyConfigurado: Boolean(config.iaGeminiApiKeyCifrado),
      },
    };
  }
}
