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
    return this.db.ncfAsignado.findMany({
      include: { sucursal: { select: { id: true, nombre: true } } },
      orderBy: [{ tipoNcf: 'asc' }, { sucursalId: 'asc' }],
    });
  }

  /** A lo sumo una fila COMPARTIDA (sucursalId: null) por tipo — Postgres no la deduplica por su cuenta (ver comentario en schema.prisma). */
  buscarActivaGlobal(tenantId: string, tipoNcf: TipoNcf) {
    return this.db.ncfAsignado.findFirst({ where: { tenantId, tipoNcf, sucursalId: null } });
  }

  buscarPorId(id: string) {
    return this.db.ncfAsignado.findUniqueOrThrow({ where: { id } });
  }

  crear(params: {
    tenantId: string;
    tipoNcf: TipoNcf;
    sucursalId?: string;
    secuenciaInicial: number;
    secuenciaFinal: number;
    vigenciaHasta: Date;
    umbralAlerta?: number;
  }) {
    return this.db.ncfAsignado.create({
      data: {
        tenantId: params.tenantId,
        tipoNcf: params.tipoNcf,
        sucursalId: params.sucursalId,
        secuenciaActual: params.secuenciaInicial,
        secuenciaFinal: params.secuenciaFinal,
        vigenciaHasta: params.vigenciaHasta,
        umbralAlerta: params.umbralAlerta,
      },
    });
  }

  actualizar(id: string, data: { secuenciaFinal?: number; vigenciaHasta?: Date; activo?: boolean; umbralAlerta?: number | null }) {
    return this.db.ncfAsignado.update({ where: { id }, data });
  }
}
