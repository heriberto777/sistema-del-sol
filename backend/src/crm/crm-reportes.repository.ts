import { Injectable } from '@nestjs/common';
import { EstadoOportunidad } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class CrmReportesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  contarLeadsPorEstado() {
    return this.db.lead.groupBy({ by: ['estado'], _count: { _all: true } });
  }

  async resumenOportunidadesAbiertas() {
    const resultado = await this.db.oportunidad.aggregate({ where: { estado: 'ABIERTA' }, _count: { _all: true }, _sum: { montoEstimado: true } });
    return { cantidad: resultado._count._all, montoTotal: Number(resultado._sum.montoEstimado ?? 0) };
  }

  async resumenCerradas(estado: Extract<EstadoOportunidad, 'GANADA' | 'PERDIDA'>, desde: Date, hasta: Date) {
    const resultado = await this.db.oportunidad.aggregate({
      where: { estado, fechaCierreReal: { gte: desde, lte: hasta } },
      _count: { _all: true },
      _sum: { montoEstimado: true },
    });
    return { cantidad: resultado._count._all, montoTotal: Number(resultado._sum.montoEstimado ?? 0) };
  }

  /** Solo los campos que hacen falta para promediar el ciclo de venta en el servicio — evita traer la fila entera. */
  gananciasParaCiclo(desde: Date, hasta: Date) {
    return this.db.oportunidad.findMany({
      where: { estado: 'GANADA', fechaCierreReal: { gte: desde, lte: hasta } },
      select: { createdAt: true, fechaCierreReal: true },
    });
  }

  /** Todo el pipeline abierto (sin tope — mismo criterio que OportunidadesRepository.listarPipeline, el forecast necesita el total real, no una página). */
  oportunidadesAbiertasParaForecast() {
    return this.db.oportunidad.findMany({
      where: { estado: 'ABIERTA' },
      select: { fechaCierreEstimada: true, montoEstimado: true, probabilidadPct: true },
    });
  }

  async rankingVendedores(desde: Date, hasta: Date) {
    const agrupado = await this.db.oportunidad.groupBy({
      by: ['vendedorId'],
      where: { estado: 'GANADA', fechaCierreReal: { gte: desde, lte: hasta } },
      _count: { _all: true },
      _sum: { montoEstimado: true },
      orderBy: { _sum: { montoEstimado: 'desc' } },
    });
    if (agrupado.length === 0) return [];

    const vendedores = await this.db.user.findMany({ where: { id: { in: agrupado.map((a) => a.vendedorId) } }, select: { id: true, nombre: true } });
    const nombrePorId = new Map(vendedores.map((v) => [v.id, v.nombre]));

    return agrupado.map((a) => ({
      vendedorId: a.vendedorId,
      nombre: nombrePorId.get(a.vendedorId) ?? '—',
      cantidadGanadas: a._count._all,
      montoGanado: Number(a._sum.montoEstimado ?? 0),
    }));
  }
}
