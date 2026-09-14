import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class EmailConfigTenantRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  async obtenerOCrear(tenantId: string) {
    const existente = await this.db.emailConfigTenant.findUnique({ where: { tenantId } });
    if (existente) return existente;
    return this.db.emailConfigTenant.create({ data: { tenantId } });
  }

  async actualizar(id: string, data: Prisma.EmailConfigTenantUpdateInput) {
    return this.db.emailConfigTenant.update({ where: { id }, data });
  }
}
