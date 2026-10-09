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
    if (dto.plantillaDocumento !== undefined) data.plantillaDocumento = dto.plantillaDocumento;
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
    if (dto.iaClaudeModelo !== undefined) data.iaClaudeModelo = dto.iaClaudeModelo;
    if (dto.iaOpenaiModelo !== undefined) data.iaOpenaiModelo = dto.iaOpenaiModelo;
    if (dto.iaGeminiModelo !== undefined) data.iaGeminiModelo = dto.iaGeminiModelo;
    if (dto.iaFondoProveedorActivo !== undefined) data.iaFondoProveedorActivo = dto.iaFondoProveedorActivo;
    if (dto.iaOpenaiModeloFondo !== undefined) data.iaOpenaiModeloFondo = dto.iaOpenaiModeloFondo;
    if (dto.iaGeminiModeloFondo !== undefined) data.iaGeminiModeloFondo = dto.iaGeminiModeloFondo;
    if (dto.iaFondoLimiteMensual !== undefined) data.iaFondoLimiteMensual = dto.iaFondoLimiteMensual;
    if (dto.iaImagenLimiteMensual !== undefined) data.iaImagenLimiteMensual = dto.iaImagenLimiteMensual;
    if (dto.iaAsistenteLimiteMensual !== undefined) data.iaAsistenteLimiteMensual = dto.iaAsistenteLimiteMensual;
    if (dto.hotelbedsMoneda !== undefined) data.hotelbedsMoneda = dto.hotelbedsMoneda || null;
    if (dto.hotelbedsTasaCambio !== undefined) data.hotelbedsTasaCambio = dto.hotelbedsTasaCambio;

    this.aplicarCampoSecreto(data, 'smtpPasswordCifrado', dto.smtpPassword);
    this.aplicarCampoSecreto(data, 'twilioAuthTokenCifrado', dto.twilioAuthToken);
    this.aplicarCampoSecreto(data, 'stripeSecretKeyCifrado', dto.stripeSecretKey);
    this.aplicarCampoSecreto(data, 'stripeWebhookSecretCifrado', dto.stripeWebhookSecret);
    this.aplicarCampoSecreto(data, 'webhookSecretCifrado', dto.webhookSecret);
    this.aplicarCampoSecreto(data, 'npmPasswordCifrado', dto.npmPassword);
    this.aplicarCampoSecreto(data, 'iaClaudeApiKeyCifrado', dto.iaClaudeApiKey);
    this.aplicarCampoSecreto(data, 'iaOpenaiApiKeyCifrado', dto.iaOpenaiApiKey);
    this.aplicarCampoSecreto(data, 'iaGeminiApiKeyCifrado', dto.iaGeminiApiKey);
    this.aplicarCampoSecreto(data, 'duffelApiTokenCifrado', dto.duffelApiToken);
    this.aplicarCampoSecreto(data, 'duffelWebhookSecretCifrado', dto.duffelWebhookSecret);
    this.aplicarCampoSecreto(data, 'hotelbedsApiKeyCifrado', dto.hotelbedsApiKey);
    this.aplicarCampoSecreto(data, 'hotelbedsSecretCifrado', dto.hotelbedsSecret);

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

  /** valor presente -> lo escribe en process.env[clave]; null/undefined/'' -> lo borra, para que un campo recién limpiado desde la pantalla deje de usarse sin reiniciar el backend. */
  private setEnv(clave: string, valor: string | null | undefined) {
    if (valor) {
      process.env[clave] = valor;
    } else {
      delete process.env[clave];
    }
  }

  private sincronizarEnv(config: PlataformaConfiguracion) {
    this.setEnv('EMAIL_HABILITADO', config.emailHabilitado !== null ? String(config.emailHabilitado) : null);
    this.setEnv('SMTP_HOST', config.smtpHost);
    this.setEnv('SMTP_PORT', config.smtpPort !== null ? String(config.smtpPort) : null);
    this.setEnv('SMTP_USER', config.smtpUser);
    this.setEnv('SMTP_PASSWORD', config.smtpPasswordCifrado ? descifrar(config.smtpPasswordCifrado) : null);
    this.setEnv('SMTP_FROM', config.smtpFrom);

    this.setEnv('TWILIO_ACCOUNT_SID', config.twilioAccountSid);
    this.setEnv('TWILIO_AUTH_TOKEN', config.twilioAuthTokenCifrado ? descifrar(config.twilioAuthTokenCifrado) : null);
    this.setEnv('TWILIO_WHATSAPP_FROM', config.twilioWhatsappFrom);

    this.setEnv('PASARELA_PAGO_ACTIVA', config.pasarelaActiva);
    this.setEnv('STRIPE_SECRET_KEY', config.stripeSecretKeyCifrado ? descifrar(config.stripeSecretKeyCifrado) : null);
    this.setEnv('STRIPE_WEBHOOK_SECRET', config.stripeWebhookSecretCifrado ? descifrar(config.stripeWebhookSecretCifrado) : null);
    this.setEnv('STRIPE_CURRENCY', config.stripeCurrency);

    this.setEnv('IA_IMAGEN_PROVEEDOR_ACTIVO', config.iaImagenProveedorActivo);
    // `ANTHROPIC_API_KEY` es la MISMA variable que ya lee IaClientService
    // (bot de WhatsApp) — configurarla acá no crea una credencial nueva.
    this.setEnv('ANTHROPIC_API_KEY', config.iaClaudeApiKeyCifrado ? descifrar(config.iaClaudeApiKeyCifrado) : null);
    this.setEnv('OPENAI_API_KEY', config.iaOpenaiApiKeyCifrado ? descifrar(config.iaOpenaiApiKeyCifrado) : null);
    this.setEnv('GEMINI_API_KEY', config.iaGeminiApiKeyCifrado ? descifrar(config.iaGeminiApiKeyCifrado) : null);
    this.setEnv('ANTHROPIC_MODEL', config.iaClaudeModelo);
    this.setEnv('OPENAI_MODEL', config.iaOpenaiModelo);
    this.setEnv('GEMINI_MODEL', config.iaGeminiModelo);

    // Publicaciones Sociales (Fase 2) — generación de fondo. Variables
    // NUEVAS y distintas de OPENAI_MODEL/GEMINI_MODEL de arriba (modelos
    // de generación de imagen son otra familia que los de vision/chat).
    this.setEnv('IA_FONDO_PROVEEDOR_ACTIVO', config.iaFondoProveedorActivo);
    this.setEnv('OPENAI_IMAGEN_MODEL', config.iaOpenaiModeloFondo);
    this.setEnv('GEMINI_IMAGEN_MODEL', config.iaGeminiModeloFondo);

    // Travel Management — cuenta Duffel compartida de la plataforma; es
    // literalmente lo que DuffelAdapter.habilitado/llamar() leen.
    this.setEnv('DUFFEL_API_TOKEN', config.duffelApiTokenCifrado ? descifrar(config.duffelApiTokenCifrado) : null);
    this.setEnv('DUFFEL_WEBHOOK_SECRET', config.duffelWebhookSecretCifrado ? descifrar(config.duffelWebhookSecretCifrado) : null);
    // Hotelbeds (hoteles) — cuenta compartida, mismo criterio que Duffel. HotelbedsAdapter lee estas dos variables directamente.
    this.setEnv('HOTELBEDS_API_KEY', config.hotelbedsApiKeyCifrado ? descifrar(config.hotelbedsApiKeyCifrado) : null);
    this.setEnv('HOTELBEDS_SECRET', config.hotelbedsSecretCifrado ? descifrar(config.hotelbedsSecretCifrado) : null);
    this.setEnv('HOTELBEDS_MONEDA', config.hotelbedsMoneda);
    this.setEnv('HOTELBEDS_TASA_CAMBIO', config.hotelbedsTasaCambio !== null ? String(config.hotelbedsTasaCambio) : null);
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
        plantillaDocumento: config.plantillaDocumento,
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
        claudeModelo: config.iaClaudeModelo,
        openaiModelo: config.iaOpenaiModelo,
        geminiModelo: config.iaGeminiModelo,
        limiteMensual: config.iaImagenLimiteMensual,
      },
      iaFondo: {
        proveedorActivo: config.iaFondoProveedorActivo,
        openaiModelo: config.iaOpenaiModeloFondo,
        geminiModelo: config.iaGeminiModeloFondo,
        limiteMensual: config.iaFondoLimiteMensual,
      },
      iaAsistente: {
        limiteMensual: config.iaAsistenteLimiteMensual,
      },
      travel: {
        duffelApiTokenConfigurado: Boolean(config.duffelApiTokenCifrado),
        duffelWebhookSecretConfigurado: Boolean(config.duffelWebhookSecretCifrado),
        hotelbedsApiKeyConfigurado: Boolean(config.hotelbedsApiKeyCifrado),
        hotelbedsSecretConfigurado: Boolean(config.hotelbedsSecretCifrado),
        hotelbedsMoneda: config.hotelbedsMoneda ?? 'EUR',
        hotelbedsTasaCambio: config.hotelbedsTasaCambio !== null ? Number(config.hotelbedsTasaCambio) : null,
      },
    };
  }
}
