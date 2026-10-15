import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class TravelConfigRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /**
   * `upsert` (no "buscar y si no existe, crear") a propósito — mismo
   * criterio que WhatsappConfigRepository.obtenerOCrear: evita la ventana
   * de carrera de dos `create()` casi simultáneos para un tenant sin fila
   * todavía.
   */
  async obtenerOCrear(tenantId: string) {
    return this.db.travelConfigTenant.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }

  async actualizar(id: string, data: Prisma.TravelConfigTenantUpdateInput) {
    return this.db.travelConfigTenant.update({ where: { id }, data });
  }
}
