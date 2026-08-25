import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, WhatsappConfigTenant } from '@prisma/client';
import { WhatsappConfigRepository } from './whatsapp-config.repository';
import { ActualizarWhatsappConfigDto } from './dto/actualizar-whatsapp-config.dto';
import { cifrar } from '../common/utils/encriptado.util';

/**
 * Solo guarda credenciales/preferencias de WhatsApp por tenant (plan de
 * integración Cuadre, ítem H-2a) — a propósito NO se conecta con
 * `WhatsAppChannel.enviar()` (notificaciones salientes existentes, que
 * siguen leyendo `TWILIO_*` de `process.env`, nivel plataforma). La
 * orquestación real del bot conversacional (H-2b) sigue diferida.
 */
@Injectable()
export class WhatsappConfigService {
  constructor(private readonly repository: WhatsappConfigRepository) {}

  async obtener(tenantId: string) {
    const config = await this.repository.obtenerOCrear(tenantId);
    return this.aFormaSegura(config);
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
    };
  }
}
