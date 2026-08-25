import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class WhatsappConfigRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  async obtenerOCrear(tenantId: string) {
    const existente = await this.db.whatsappConfigTenant.findUnique({ where: { tenantId } });
    if (existente) return existente;
    return this.db.whatsappConfigTenant.create({ data: { tenantId } });
  }

  async actualizar(id: string, data: Prisma.WhatsappConfigTenantUpdateInput) {
    return this.db.whatsappConfigTenant.update({ where: { id }, data });
  }
}
