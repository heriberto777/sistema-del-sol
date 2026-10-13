import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

interface FiltrosActividad {
  skip: number;
  take: number;
  busqueda?: string;
  usuarioId?: string;
  desde?: string;
  hasta?: string;
}

interface FiltrosErrores {
  skip: number;
  take: number;
  busqueda?: string;
  desde?: string;
  hasta?: string;
}

@Injectable()
export class AuditoriaRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private rangoFecha(desde?: string, hasta?: string): Prisma.DateTimeFilter | undefined {
    if (!desde && !hasta) return undefined;
    return { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) };
  }

  async listarActividad({ skip, take, busqueda, usuarioId, desde, hasta }: FiltrosActividad) {
    const where: Prisma.AuditLogWhereInput = {
      ...(usuarioId ? { userId: usuarioId } : {}),
      ...(this.rangoFecha(desde, hasta) ? { createdAt: this.rangoFecha(desde, hasta) } : {}),
      ...(busqueda
        ? {
            OR: [
              { accion: { contains: busqueda, mode: 'insensitive' as const } },
              { entidad: { contains: busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [datos, total] = await Promise.all([
      this.tenantPrisma.client.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, nombre: true, email: true } } },
        skip,
        take,
      }),
      this.tenantPrisma.client.auditLog.count({ where }),
    ]);

    return { datos, total };
  }

  /** Usuarios con al menos un registro de auditoría — alimenta el filtro del frontend sin depender de `admin.usuarios`. */
  async listarUsuariosConActividad() {
    const filas = await this.tenantPrisma.client.auditLog.findMany({
      where: { userId: { not: null } },
      distinct: ['userId'],
      select: { user: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return filas.map((f) => f.user).filter((u): u is { id: string; nombre: string } => !!u);
  }

  async listarErrores({ skip, take, busqueda, desde, hasta }: FiltrosErrores) {
    const where: Prisma.ErrorLogWhereInput = {
      ...(this.rangoFecha(desde, hasta) ? { createdAt: this.rangoFecha(desde, hasta) } : {}),
      ...(busqueda
        ? {
            OR: [
              { mensaje: { contains: busqueda, mode: 'insensitive' as const } },
              { ruta: { contains: busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [datos, total] = await Promise.all([
      this.tenantPrisma.client.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, nombre: true, email: true } } },
        skip,
        take,
      }),
      this.tenantPrisma.client.errorLog.count({ where }),
    ]);

    return { datos, total };
  }
}
