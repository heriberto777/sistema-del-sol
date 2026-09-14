import { BadRequestException, Injectable } from '@nestjs/common';
import { EmailConfigTenant, Prisma } from '@prisma/client';
import { EmailConfigTenantRepository } from './email-config-tenant.repository';
import { ActualizarEmailConfigTenantDto } from './dto/actualizar-email-config-tenant.dto';
import { cifrar } from '../common/utils/encriptado.util';

/**
 * SMTP propio por tenant (mismo molde de 4 capas que WhatsappConfigTenant:
 * obtenerOCrear/aplicarCampoSecreto/aFormaSegura) — el consumo real vive en
 * EmailChannel.enviar(), que resuelve esta config directo con
 * PrismaService global (no depende de este módulo).
 */
@Injectable()
export class EmailConfigTenantService {
  constructor(private readonly repository: EmailConfigTenantRepository) {}

  async obtener(tenantId: string) {
    const config = await this.repository.obtenerOCrear(tenantId);
    return this.aFormaSegura(config);
  }

  async actualizar(tenantId: string, dto: ActualizarEmailConfigTenantDto) {
    const config = await this.repository.obtenerOCrear(tenantId);
    const data: Prisma.EmailConfigTenantUpdateInput = {};

    if (dto.habilitado !== undefined) data.habilitado = dto.habilitado;
    if (dto.smtpHost !== undefined) data.smtpHost = dto.smtpHost;
    if (dto.smtpPort !== undefined) data.smtpPort = dto.smtpPort;
    if (dto.smtpUser !== undefined) data.smtpUser = dto.smtpUser;
    if (dto.smtpFrom !== undefined) data.smtpFrom = dto.smtpFrom;

    if (dto.smtpPassword !== undefined) {
      if (dto.smtpPassword === '') {
        data.smtpPasswordCifrado = null;
      } else {
        try {
          data.smtpPasswordCifrado = cifrar(dto.smtpPassword);
        } catch (error) {
          throw new BadRequestException((error as Error).message);
        }
      }
    }

    const actualizado = await this.repository.actualizar(config.id, data);
    return this.aFormaSegura(actualizado);
  }

  /** Nunca expone la contraseña en texto plano — solo si hay una guardada (smtpPasswordConfigurado). */
  private aFormaSegura(config: EmailConfigTenant) {
    return {
      habilitado: config.habilitado,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpUser: config.smtpUser,
      smtpPasswordConfigurado: Boolean(config.smtpPasswordCifrado),
      smtpFrom: config.smtpFrom,
    };
  }
}
