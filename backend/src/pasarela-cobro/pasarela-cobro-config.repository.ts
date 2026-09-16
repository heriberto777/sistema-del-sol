import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class PasarelaCobroConfigRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** `upsert` (no "buscar y si no existe, crear") — ver el comentario en WhatsappConfigRepository.obtenerOCrear, mismo motivo exacto. */
  async obtenerOCrear(tenantId: string) {
    return this.db.pasarelaConfigTenant.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }

  async actualizar(id: string, data: Prisma.PasarelaConfigTenantUpdateInput) {
    return this.db.pasarelaConfigTenant.update({ where: { id }, data });
  }
}
