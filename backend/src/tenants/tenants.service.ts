import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TenantsRepository } from './tenants.repository';
import { CrearTenantDto } from './dto/crear-tenant.dto';
import { ActualizarTenantDto } from './dto/actualizar-tenant.dto';
import { ResetearTenantDto } from './dto/resetear-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly tenantsRepository: TenantsRepository) {}

  async crear(dto: CrearTenantDto) {
    const adminPasswordHash = await bcrypt.hash(dto.adminPassword, 10);
    return this.tenantsRepository.crearConProvisioning({
      nombre: dto.nombre,
      subdominio: dto.subdominio,
      rnc: dto.rnc,
      direccion: dto.direccion,
      telefono: dto.telefono,
      email: dto.email,
      logo: dto.logo,
      planId: dto.planId,
      adminEmail: dto.adminEmail,
      adminNombre: dto.adminNombre,
      adminPasswordHash,
    });
  }

  listar() {
    return this.tenantsRepository.listar();
  }

  buscarPorId(id: string) {
    return this.tenantsRepository.buscarPorId(id);
  }

  actualizar(id: string, dto: ActualizarTenantDto) {
    return this.tenantsRepository.actualizar(id, dto);
  }

  /**
   * Acción destructiva e irreversible — la confirmación por subdominio
   * tipeado (mismo criterio que un borrado, ver `feedback_no_confirm_nativo`)
   * se valida acá, antes de tocar la base de datos. `platform.tenants.resetear`
   * (guard del controller) ya restringe quién puede llamar esto; esta
   * segunda verificación evita un reseteo por error de tenant equivocado
   * (ej. un id copiado mal) aunque el permiso esté bien otorgado.
   */
  async resetear(id: string, dto: ResetearTenantDto) {
    const tenant = await this.tenantsRepository.buscarPorId(id);
    if (dto.confirmacionSubdominio !== tenant.subdominio) {
      throw new BadRequestException('El subdominio tipeado no coincide con el de este tenant — reseteo cancelado.');
    }
    return this.tenantsRepository.resetear(id, dto.modo);
  }
}
