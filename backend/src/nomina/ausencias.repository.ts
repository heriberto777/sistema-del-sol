import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EstadoAusencia, TipoAusencia } from '@prisma/client';

const INCLUDE_AUSENCIA = {
  empleado: { select: { id: true, nombre: true, cedula: true } },
  solicitadoPor: { select: { id: true, nombre: true } },
  aprobadoPor: { select: { id: true, nombre: true } },
} as const;

@Injectable()
export class AusenciasRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(params: {
    tenantId: string;
    empleadoId: string;
    tipo: TipoAusencia;
    fechaDesde: Date;
    fechaHasta: Date;
    conGoceDeSueldo: boolean;
    motivo?: string;
    solicitadoPorId: string;
    estado?: EstadoAusencia;
    aprobadoPorId?: string;
    fechaResolucion?: Date;
  }) {
    return this.db.ausencia.create({ data: params, include: INCLUDE_AUSENCIA });
  }

  buscarPorId(id: string) {
    return this.db.ausencia.findUniqueOrThrow({ where: { id }, include: INCLUDE_AUSENCIA });
  }

  actualizarEstado(id: string, estado: EstadoAusencia, aprobadoPorId: string, fechaResolucion: Date) {
    return this.db.ausencia.update({ where: { id }, data: { estado, aprobadoPorId, fechaResolucion }, include: INCLUDE_AUSENCIA });
  }

  listar(params: { empleadoId?: string; estado?: EstadoAusencia; skip: number; take: number }) {
    const where = { empleadoId: params.empleadoId, estado: params.estado };
    return Promise.all([
      this.db.ausencia.findMany({ where, include: INCLUDE_AUSENCIA, orderBy: { fechaDesde: 'desc' }, skip: params.skip, take: params.take }),
      this.db.ausencia.count({ where }),
    ]);
  }

  /** VACACIONES ya tomadas (APROBADA) — usado por el balance de vacaciones. */
  listarVacacionesAprobadas(empleadoId: string) {
    return this.db.ausencia.findMany({
      where: { empleadoId, tipo: 'VACACIONES', estado: 'APROBADA' },
      select: { fechaDesde: true, fechaHasta: true },
    });
  }

  /** Ausencias APROBADAS sin goce de sueldo que se solapan con un período — usado por el prorrateo de nómina. */
  listarSinGoceSolapadas(empleadoId: string, desde: Date, hasta: Date) {
    return this.db.ausencia.findMany({
      where: { empleadoId, estado: 'APROBADA', conGoceDeSueldo: false, fechaDesde: { lte: hasta }, fechaHasta: { gte: desde } },
      select: { fechaDesde: true, fechaHasta: true },
    });
  }
}
