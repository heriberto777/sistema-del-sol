import { Injectable } from '@nestjs/common';
import { EstadoReporteTenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginar } from '../common/types/pagina-resultado';
import { ResponderReporteTenantDto } from './dto/responder-reporte-tenant.dto';

const INCLUDE_REPORTE = {
  tenant: { select: { id: true, nombre: true, subdominio: true } },
  usuario: { select: { id: true, nombre: true, email: true } },
  respondidoPor: { select: { id: true, nombre: true } },
} as const;

/** Cruza todos los tenants — a propósito, `PrismaService` global (el lado tenant usa `TenantPrismaService`, ver `reportes-tenant.repository.ts`). */
@Injectable()
export class PlatformReportesTenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: { pagina?: number; tamanoPagina?: number; busqueda?: string; tenantId?: string; estado?: EstadoReporteTenant }) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const where = {
      tenantId: query.tenantId,
      estado: query.estado,
      ...(query.busqueda
        ? {
            OR: [
              { asunto: { contains: query.busqueda, mode: 'insensitive' as const } },
              { tenant: { nombre: { contains: query.busqueda, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [datos, total] = await Promise.all([
      this.prisma.reporteTenant.findMany({ where, include: INCLUDE_REPORTE, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.reporteTenant.count({ where }),
    ]);

    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.prisma.reporteTenant.findUniqueOrThrow({ where: { id }, include: INCLUDE_REPORTE });
  }

  responder(id: string, dto: ResponderReporteTenantDto, adminId: string) {
    return this.prisma.reporteTenant.update({
      where: { id },
      data: {
        estado: dto.estado,
        respuesta: dto.respuesta,
        respondidoPorId: adminId,
        respondidoEn: new Date(),
      },
      include: INCLUDE_REPORTE,
    });
  }

  /** Para el badge del sidebar de plataforma — solo cuenta, nunca trae filas. */
  contarNuevos() {
    return this.prisma.reporteTenant.count({ where: { estado: 'NUEVO' } });
  }
}
