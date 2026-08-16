import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class ConfiguracionesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listar() {
    return this.db.configuracion.findMany({ orderBy: { clave: 'asc' } });
  }

  actualizar(clave: string, valor: string, tenantId: string) {
    return this.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId, clave } },
      update: { valor },
      create: { tenantId, clave, valor },
    });
  }
}
