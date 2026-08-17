import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolverModulosConOrigen } from './resolver-modulos-activos';

@Injectable()
export class TenantModulosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(tenantId: string) {
    return resolverModulosConOrigen(this.prisma, tenantId);
  }

  async actualizarOverride(tenantId: string, clave: string, activo: boolean | null) {
    const modulo = await this.prisma.modulo.findUniqueOrThrow({ where: { clave } });

    if (activo === null) {
      await this.prisma.tenantModuloOverride.deleteMany({ where: { tenantId, moduloId: modulo.id } });
    } else {
      await this.prisma.tenantModuloOverride.upsert({
        where: { tenantId_moduloId: { tenantId, moduloId: modulo.id } },
        update: { activo },
        create: { tenantId, moduloId: modulo.id, activo },
      });
    }

    return resolverModulosConOrigen(this.prisma, tenantId);
  }
}
