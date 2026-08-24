import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TipoAusencia } from '@prisma/client';

@Injectable()
export class TiposAusenciaConfigRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listar() {
    return this.db.tipoAusenciaConfig.findMany({ orderBy: { tipo: 'asc' } });
  }

  buscarPorTipo(tipo: TipoAusencia, tenantId: string) {
    return this.db.tipoAusenciaConfig.findUnique({ where: { tenantId_tipo: { tenantId, tipo } } });
  }

  actualizar(
    tipo: TipoAusencia,
    tenantId: string,
    data: { maximoDiasPorAnio?: number | null; conGoceDeSueldoPorDefecto?: boolean; requiereAprobacion?: boolean; activo?: boolean },
  ) {
    return this.db.tipoAusenciaConfig.update({ where: { tenantId_tipo: { tenantId, tipo } }, data });
  }

  /** Días ya usados en el año de `fecha`, en ausencias APROBADAS de ese tipo — usado para el tope configurable (no aplica a VACACIONES, que tiene su propio balance legal). */
  async sumarDiasAprobadosEnAnio(empleadoId: string, tipo: TipoAusencia, anio: number): Promise<number> {
    const desde = new Date(anio, 0, 1);
    const hasta = new Date(anio, 11, 31, 23, 59, 59, 999);
    const ausencias = await this.db.ausencia.findMany({
      where: { empleadoId, tipo, estado: 'APROBADA', fechaDesde: { lte: hasta }, fechaHasta: { gte: desde } },
      select: { fechaDesde: true, fechaHasta: true },
    });
    const MS_POR_DIA = 24 * 60 * 60 * 1000;
    return ausencias.reduce((acc, a) => acc + Math.round((a.fechaHasta.getTime() - a.fechaDesde.getTime()) / MS_POR_DIA) + 1, 0);
  }
}
