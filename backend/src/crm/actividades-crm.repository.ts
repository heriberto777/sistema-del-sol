import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearActividadCrmDto } from './dto/crear-actividad-crm.dto';

const INCLUDE_ACTIVIDAD = {
  usuario: { select: { id: true, nombre: true } },
} satisfies Prisma.ActividadCrmInclude;

interface FiltrosActividades {
  skip: number;
  take: number;
  clienteId?: string;
  leadId?: string;
  oportunidadId?: string;
  completada?: boolean;
}

@Injectable()
export class ActividadesCrmRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearActividadCrmDto & { tenantId: string; usuarioId: string }) {
    return this.db.actividadCrm.create({
      data: { ...dto, fechaProgramada: dto.fechaProgramada ? new Date(dto.fechaProgramada) : undefined },
      include: INCLUDE_ACTIVIDAD,
    });
  }

  async listar({ skip, take, clienteId, leadId, oportunidadId, completada }: FiltrosActividades) {
    const where: Prisma.ActividadCrmWhereInput = {
      ...(clienteId ? { clienteId } : {}),
      ...(leadId ? { leadId } : {}),
      ...(oportunidadId ? { oportunidadId } : {}),
      ...(completada !== undefined ? { completada } : {}),
    };

    const [datos, total] = await Promise.all([
      this.db.actividadCrm.findMany({ where, orderBy: { createdAt: 'desc' }, include: INCLUDE_ACTIVIDAD, skip, take }),
      this.db.actividadCrm.count({ where }),
    ]);

    return { datos, total };
  }

  buscarPorId(id: string) {
    return this.db.actividadCrm.findUniqueOrThrow({ where: { id } });
  }

  marcarCompletada(id: string, completada: boolean) {
    return this.db.actividadCrm.update({ where: { id }, data: { completada }, include: INCLUDE_ACTIVIDAD });
  }

  eliminar(id: string) {
    return this.db.actividadCrm.delete({ where: { id } });
  }
}
