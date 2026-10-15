import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, TravelConfigTenant } from '@prisma/client';
import { TravelConfigRepository } from './travel-config.repository';
import { ActualizarTravelConfigDto } from './dto/actualizar-travel-config.dto';
import { cifrar, descifrar } from '../common/utils/encriptado.util';
import { CredencialesDuffel } from '../travel/providers/travel-provider.interface';
import { CredencialesHotelbeds } from '../travel/providers/hotel-provider.interface';

/**
 * Guarda la cuenta de Duffel/Hotelbeds PROPIA de cada tenant (ítem "El
 * plugin de Travel pasa a ser per-tenant") — reemplaza a la cuenta única y
 * compartida que antes vivía en PlataformaConfiguracion. El consumo real
 * de estos datos (resolver credenciales antes de llamar al proveedor, o
 * resolver el tenant de un webhook entrante) vive en `backend/src/travel/`,
 * no acá — mismo criterio que WhatsappConfigService/WhatsappBotService.
 */
@Injectable()
export class TravelConfigService {
  constructor(private readonly repository: TravelConfigRepository) {}

  async obtener(tenantId: string) {
    const config = await this.repository.obtenerOCrear(tenantId);
    return this.aFormaSegura(config);
  }

  async actualizar(tenantId: string, dto: ActualizarTravelConfigDto) {
    const config = await this.repository.obtenerOCrear(tenantId);
    const data: Prisma.TravelConfigTenantUpdateInput = {};

    if (dto.hotelbedsMoneda !== undefined) data.hotelbedsMoneda = dto.hotelbedsMoneda || null;
    if (dto.hotelbedsTasaCambio !== undefined) data.hotelbedsTasaCambio = dto.hotelbedsTasaCambio;

    this.aplicarCampoSecreto(data, 'duffelApiTokenCifrado', dto.duffelApiToken);
    this.aplicarCampoSecreto(data, 'duffelWebhookSecretCifrado', dto.duffelWebhookSecret);
    this.aplicarCampoSecreto(data, 'hotelbedsApiKeyCifrado', dto.hotelbedsApiKey);
    this.aplicarCampoSecreto(data, 'hotelbedsSecretCifrado', dto.hotelbedsSecret);

    const actualizado = await this.repository.actualizar(config.id, data);
    return this.aFormaSegura(actualizado);
  }

  /** valor undefined = sin cambios; "" = borra el override; string no vacío = cifra y guarda. */
  private aplicarCampoSecreto(data: Prisma.TravelConfigTenantUpdateInput, campo: string, valor: string | undefined) {
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

  /** Para TravelService — credenciales reales ya descifradas, listas para pasarle a DuffelAdapter. Lanza 503 si el tenant no cargó su cuenta todavía (sin fallback a ninguna cuenta compartida). */
  async obtenerCredencialesDuffel(tenantId: string): Promise<CredencialesDuffel> {
    const config = await this.repository.obtenerOCrear(tenantId);
    if (!config.duffelApiTokenCifrado) {
      throw new ServiceUnavailableException('Este tenant todavía no configuró su cuenta de Duffel — cargala en Configuración → Viajes antes de buscar o reservar vuelos.');
    }
    return { token: descifrar(config.duffelApiTokenCifrado) };
  }

  /** Mismo criterio que obtenerCredencialesDuffel, para HotelbedsAdapter. */
  async obtenerCredencialesHotelbeds(tenantId: string): Promise<CredencialesHotelbeds> {
    const config = await this.repository.obtenerOCrear(tenantId);
    if (!config.hotelbedsApiKeyCifrado || !config.hotelbedsSecretCifrado) {
      throw new ServiceUnavailableException('Este tenant todavía no configuró su cuenta de Hotelbeds — cargala en Configuración → Viajes antes de buscar o reservar hoteles.');
    }
    const moneda = config.hotelbedsMoneda || 'EUR';
    const tasaConfigurada = Number(config.hotelbedsTasaCambio);
    const tasaCambio = moneda === 'EUR' ? 1 : Number.isFinite(tasaConfigurada) && tasaConfigurada > 0 ? tasaConfigurada : 1;
    return { apiKey: descifrar(config.hotelbedsApiKeyCifrado), secret: descifrar(config.hotelbedsSecretCifrado), moneda, tasaCambio };
  }

  /** Nunca expone un secreto en texto plano — solo si hay uno guardado (*Configurado). */
  private aFormaSegura(config: TravelConfigTenant) {
    return {
      duffelApiTokenConfigurado: Boolean(config.duffelApiTokenCifrado),
      duffelWebhookSecretConfigurado: Boolean(config.duffelWebhookSecretCifrado),
      hotelbedsApiKeyConfigurado: Boolean(config.hotelbedsApiKeyCifrado),
      hotelbedsSecretConfigurado: Boolean(config.hotelbedsSecretCifrado),
      hotelbedsMoneda: config.hotelbedsMoneda ?? 'EUR',
      hotelbedsTasaCambio: config.hotelbedsTasaCambio !== null ? Number(config.hotelbedsTasaCambio) : null,
    };
  }
}
