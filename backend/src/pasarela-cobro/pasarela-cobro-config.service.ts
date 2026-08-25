import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PasarelaConfigTenant } from '@prisma/client';
import { PasarelaCobroConfigRepository } from './pasarela-cobro-config.repository';
import { ActualizarPasarelaConfigDto } from './dto/actualizar-pasarela-config.dto';
import { cifrar } from '../common/utils/encriptado.util';

/**
 * Solo guarda credenciales de AZUL/CardNet por tenant (ítem C-1, Payment
 * Link) — mismo molde de 4 capas que WhatsappConfigService
 * (aplicarCampoSecreto/aFormaSegura). El consumo real (armar el checkout,
 * descifrar para llamar a AZUL/CardNet) vive en los adapters de
 * `pasarela-cobro/adapters/`, no acá — este service es solo el CRUD de
 * configuración que ve el admin del tenant.
 */
@Injectable()
export class PasarelaCobroConfigService {
  constructor(private readonly repository: PasarelaCobroConfigRepository) {}

  async obtener(tenantId: string) {
    const config = await this.repository.obtenerOCrear(tenantId);
    return this.aFormaSegura(config);
  }

  async actualizar(tenantId: string, dto: ActualizarPasarelaConfigDto) {
    const config = await this.repository.obtenerOCrear(tenantId);
    const data: Prisma.PasarelaConfigTenantUpdateInput = {};

    if (dto.pasarelaActiva !== undefined) data.pasarelaActiva = dto.pasarelaActiva;
    if (dto.azulMerchantId !== undefined) data.azulMerchantId = dto.azulMerchantId;
    if (dto.azulMerchantName !== undefined) data.azulMerchantName = dto.azulMerchantName;
    if (dto.azulCurrencyCode !== undefined) data.azulCurrencyCode = dto.azulCurrencyCode;
    if (dto.cardnetMerchantNumber !== undefined) data.cardnetMerchantNumber = dto.cardnetMerchantNumber;
    if (dto.cardnetMerchantTerminal !== undefined) data.cardnetMerchantTerminal = dto.cardnetMerchantTerminal;
    if (dto.cardnetMerchantName !== undefined) data.cardnetMerchantName = dto.cardnetMerchantName;

    this.aplicarCampoSecreto(data, 'azulAuthKeyCifrado', dto.azulAuthKey);
    this.aplicarCampoSecreto(data, 'cardnetAuthKeyCifrado', dto.cardnetAuthKey);

    const actualizado = await this.repository.actualizar(config.id, data);
    return this.aFormaSegura(actualizado);
  }

  /** valor undefined = sin cambios; "" = borra el override; string no vacío = cifra y guarda. */
  private aplicarCampoSecreto(data: Prisma.PasarelaConfigTenantUpdateInput, campo: string, valor: string | undefined) {
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
  private aFormaSegura(config: PasarelaConfigTenant) {
    return {
      pasarelaActiva: config.pasarelaActiva,
      azul: {
        merchantId: config.azulMerchantId,
        merchantName: config.azulMerchantName,
        currencyCode: config.azulCurrencyCode,
        authKeyConfigurado: Boolean(config.azulAuthKeyCifrado),
      },
      cardnet: {
        merchantNumber: config.cardnetMerchantNumber,
        merchantTerminal: config.cardnetMerchantTerminal,
        merchantName: config.cardnetMerchantName,
        authKeyConfigurado: Boolean(config.cardnetAuthKeyCifrado),
      },
    };
  }
}
