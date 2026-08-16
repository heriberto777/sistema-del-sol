import { Injectable } from '@nestjs/common';
import { ModalidadFacturacion, TipoNcf } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class NcfRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** `Tenant` no es tenant-scoped (es la tabla raíz) — se filtra por `id` directo. */
  async obtenerModalidad(tenantId: string): Promise<ModalidadFacturacion> {
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { modalidadFacturacion: true },
    });
    return tenant.modalidadFacturacion;
  }

  async actualizarModalidad(tenantId: string, modalidad: ModalidadFacturacion) {
    const tenant = await this.db.tenant.update({
      where: { id: tenantId },
      data: { modalidadFacturacion: modalidad },
      select: { modalidadFacturacion: true },
    });
    return tenant.modalidadFacturacion;
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
