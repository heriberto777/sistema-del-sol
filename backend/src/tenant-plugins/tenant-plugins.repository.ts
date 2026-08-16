import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class TenantPluginsRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listarInstalados() {
    return this.db.tenantPlugin.findMany();
  }

  setActivo(pluginKey: string, activo: boolean, tenantId: string) {
    return this.db.tenantPlugin.upsert({
      where: { tenantId_pluginKey: { tenantId, pluginKey } },
      update: { activo },
      create: { tenantId, pluginKey, activo },
    });
  }
}
