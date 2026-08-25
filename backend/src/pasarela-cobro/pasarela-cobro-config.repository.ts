import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class PasarelaCobroConfigRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  async obtenerOCrear(tenantId: string) {
    const existente = await this.db.pasarelaConfigTenant.findUnique({ where: { tenantId } });
    if (existente) return existente;
    return this.db.pasarelaConfigTenant.create({ data: { tenantId } });
  }

  async actualizar(id: string, data: Prisma.PasarelaConfigTenantUpdateInput) {
    return this.db.pasarelaConfigTenant.update({ where: { id }, data });
  }
}
