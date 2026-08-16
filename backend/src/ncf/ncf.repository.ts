import { Injectable } from '@nestjs/common';
import { TipoNcf } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class NcfRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listar() {
    return this.db.ncfAsignado.findMany({ orderBy: { tipoNcf: 'asc' } });
  }

  crear(params: { tenantId: string; tipoNcf: TipoNcf; secuenciaInicial: number; secuenciaFinal: number; vigenciaHasta: Date }) {
    return this.db.ncfAsignado.create({
      data: {
        tenantId: params.tenantId,
        tipoNcf: params.tipoNcf,
        secuenciaActual: params.secuenciaInicial,
        secuenciaFinal: params.secuenciaFinal,
        vigenciaHasta: params.vigenciaHasta,
      },
    });
  }

  actualizar(tenantId: string, tipoNcf: TipoNcf, data: { secuenciaFinal?: number; vigenciaHasta?: Date; activo?: boolean }) {
    return this.db.ncfAsignado.update({
      where: { tenantId_tipoNcf: { tenantId, tipoNcf } },
      data,
    });
  }
}
