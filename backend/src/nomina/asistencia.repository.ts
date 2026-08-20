import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const INCLUDE_EMPLEADO = { empleado: { select: { id: true, nombre: true, cedula: true } } } as const;

@Injectable()
export class AsistenciaRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  buscarDelDia(tenantId: string, empleadoId: string, fecha: Date) {
    return this.db.registroAsistencia.findUnique({ where: { tenantId_empleadoId_fecha: { tenantId, empleadoId, fecha } } });
  }

  crear(params: { tenantId: string; empleadoId: string; fecha: Date; horaEntrada?: string; horaSalida?: string; tardanza: boolean }) {
    return this.db.registroAsistencia.create({ data: params, include: INCLUDE_EMPLEADO });
  }

  actualizar(id: string, data: Partial<{ horaEntrada: string; horaSalida: string; tardanza: boolean }>) {
    return this.db.registroAsistencia.update({ where: { id }, data, include: INCLUDE_EMPLEADO });
  }

  listar(params: { empleadoId?: string; desde?: Date; hasta?: Date; skip: number; take: number }) {
    const where = {
      empleadoId: params.empleadoId,
      ...(params.desde || params.hasta
        ? { fecha: { ...(params.desde ? { gte: params.desde } : {}), ...(params.hasta ? { lte: params.hasta } : {}) } }
        : {}),
    };
    return Promise.all([
      this.db.registroAsistencia.findMany({ where, include: INCLUDE_EMPLEADO, orderBy: { fecha: 'desc' }, skip: params.skip, take: params.take }),
      this.db.registroAsistencia.count({ where }),
    ]);
  }
}
