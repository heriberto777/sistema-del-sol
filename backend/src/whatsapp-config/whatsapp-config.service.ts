import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, WhatsappConfigTenant } from '@prisma/client';
import { WhatsappConfigRepository } from './whatsapp-config.repository';
import { ActualizarWhatsappConfigDto } from './dto/actualizar-whatsapp-config.dto';
import { cifrar, descifrar } from '../common/utils/encriptado.util';
import { ConversacionIaService } from '../ia/conversacion/conversacion-ia.service';
import { ModeloIa } from '../ia/analizador-imagen/analizador-imagen.interface';
import { construirPromptComportamientoBot } from './sugerir-comportamiento.prompt';

/**
 * Guarda credenciales/preferencias de WhatsApp por tenant (ítems H-2a y
 * H-2b) — a propósito NO se conecta con `WhatsAppChannel.enviar()`
 * (notificaciones salientes existentes, que siguen leyendo `TWILIO_*` de
 * `process.env`, nivel plataforma). El consumo real de estos datos vive
 * en `backend/src/whatsapp-bot/` (`WhatsappBotService`).
 */
@Injectable()
export class WhatsappConfigService {
  constructor(
    private readonly repository: WhatsappConfigRepository,
    private readonly conversacionIaService: ConversacionIaService,
  ) {}

  async obtener(tenantId: string) {
    const config = await this.repository.obtenerOCrear(tenantId);
    return this.aFormaSegura(config);
  }

  /** Modelos reales disponibles para la API key YA GUARDADA de este tenant — mismo criterio que AnalizadorImagenService.listarModelos. */
  async listarModelos(tenantId: string, proveedor: string): Promise<ModeloIa[]> {
    const config = await this.repository.obtenerOCrear(tenantId);
    if (!config.iaApiKeyCifrado) {
      throw new BadRequestException('Guarda primero la API key de este proveedor para poder listar sus modelos');
    }
    const apiKey = descifrar(config.iaApiKeyCifrado);
    return this.conversacionIaService.listarModelos(proveedor, apiKey);
  }

  /**
   * Borrador de "Información del negocio" a partir de datos reales del
   * tenant (nombre, dirección, categorías/productos ya cargados) — nunca
   * se guarda solo, el admin lo revisa en el textarea y recién ahí decide
   * guardar (ver WhatsappConfigPanel.tsx). Usa el MISMO proveedor/key/
   * modelo ya configurados para el bot — si todavía no hay uno guardado,
   * no hay con qué generar la sugerencia.
   */
  async sugerirComportamiento(tenantId: string): Promise<{ texto: string }> {
    const config = await this.repository.obtenerOCrear(tenantId);
    if (!config.iaProveedor || !config.iaApiKeyCifrado) {
      throw new BadRequestException('Configurá primero un proveedor de IA y su API key arriba para poder sugerir un texto.');
    }
    const apiKey = descifrar(config.iaApiKeyCifrado);
    const contexto = await this.repository.obtenerContextoNegocio(tenantId);
    const prompt = construirPromptComportamientoBot(contexto);

    const texto = await this.conversacionIaService.completar(config.iaProveedor, [{ role: 'user', content: prompt }], {
      apiKey,
      modelo: config.iaModelo ?? undefined,
      maxTokens: 400,
    });
    if (!texto) throw new ServiceUnavailableException('No se pudo generar una sugerencia — probá de nuevo.');
    return { texto: texto.trim() };
  }

  async actualizar(tenantId: string, dto: ActualizarWhatsappConfigDto) {
    const config = await this.repository.obtenerOCrear(tenantId);
    const data: Prisma.WhatsappConfigTenantUpdateInput = {};

    if (dto.habilitado !== undefined) data.habilitado = dto.habilitado;
    if (dto.twilioAccountSid !== undefined) data.twilioAccountSid = dto.twilioAccountSid;
    if (dto.twilioWhatsappFrom !== undefined) data.twilioWhatsappFrom = dto.twilioWhatsappFrom;
    if (dto.iaProveedor !== undefined) data.iaProveedor = dto.iaProveedor;
    if (dto.iaModelo !== undefined) data.iaModelo = dto.iaModelo;
    if (dto.historialMensajes !== undefined) data.historialMensajes = dto.historialMensajes;
    if (dto.iaPromptNegocio !== undefined) data.iaPromptNegocio = dto.iaPromptNegocio;
    if (dto.limiteRespuestasDiarias !== undefined) data.limiteRespuestasDiarias = dto.limiteRespuestasDiarias;
    if (dto.twilioTemplateAprobacionSid !== undefined) data.twilioTemplateAprobacionSid = dto.twilioTemplateAprobacionSid;

    this.aplicarCampoSecreto(data, 'twilioAuthTokenCifrado', dto.twilioAuthToken);
    this.aplicarCampoSecreto(data, 'iaApiKeyCifrado', dto.iaApiKey);

    const actualizado = await this.repository.actualizar(config.id, data);
    return this.aFormaSegura(actualizado);
  }

  /** valor undefined = sin cambios; "" = borra el override; string no vacío = cifra y guarda. */
  private aplicarCampoSecreto(data: Prisma.WhatsappConfigTenantUpdateInput, campo: string, valor: string | undefined) {
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

  /** Nunca expone un secreto en texto plano — solo si hay uno guardado (*Configurado). */
  private aFormaSegura(config: WhatsappConfigTenant) {
    return {
      habilitado: config.habilitado,
      twilioAccountSid: config.twilioAccountSid,
      twilioAuthTokenConfigurado: Boolean(config.twilioAuthTokenCifrado),
      twilioWhatsappFrom: config.twilioWhatsappFrom,
      iaProveedor: config.iaProveedor,
      iaModelo: config.iaModelo,
      iaApiKeyConfigurado: Boolean(config.iaApiKeyCifrado),
      historialMensajes: config.historialMensajes,
      iaPromptNegocio: config.iaPromptNegocio,
      limiteRespuestasDiarias: config.limiteRespuestasDiarias,
      twilioTemplateAprobacionSid: config.twilioTemplateAprobacionSid,
    };
  }
}
