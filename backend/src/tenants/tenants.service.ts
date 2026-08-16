import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TenantsRepository } from './tenants.repository';
import { CrearTenantDto } from './dto/crear-tenant.dto';
import { ActualizarTenantDto } from './dto/actualizar-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly tenantsRepository: TenantsRepository) {}

  async crear(dto: CrearTenantDto) {
    const adminPasswordHash = await bcrypt.hash(dto.adminPassword, 10);
    return this.tenantsRepository.crearConProvisioning({
      nombre: dto.nombre,
      subdominio: dto.subdominio,
      rnc: dto.rnc,
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
}
