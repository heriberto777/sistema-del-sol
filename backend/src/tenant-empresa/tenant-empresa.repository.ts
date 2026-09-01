import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const SELECT_EMPRESA = { nombre: true, rnc: true, direccion: true, telefono: true, email: true } as const;

/** `Tenant` no es tenant-scoped (es la tabla raíz) — se filtra por `id` directo, mismo criterio que NcfRepository.obtenerModalidad. */
@Injectable()
export class TenantEmpresaRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  obtener(tenantId: string) {
    return this.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: SELECT_EMPRESA });
  }

  actualizar(tenantId: string, data: { nombre?: string; rnc?: string; direccion?: string; telefono?: string; email?: string }) {
    return this.db.tenant.update({ where: { id: tenantId }, data, select: SELECT_EMPRESA });
  }
}
