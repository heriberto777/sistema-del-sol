import { Injectable } from '@nestjs/common';
import { EstadoDominioTenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Gestionado exclusivamente por controllers de plataforma (super admin) —
 * mismo criterio que TenantsRepository: PrismaService directo, nunca
 * TenantPrismaService (no hay sesión de tenant en estas rutas).
 */
@Injectable()
export class TenantDominiosRepository {
  constructor(private readonly prisma: PrismaService) {}

  listarPorTenant(tenantId: string) {
    return this.prisma.tenantDominio.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  }

  buscarPorId(id: string) {
    return this.prisma.tenantDominio.findUnique({ where: { id } });
  }

  buscarPorDominio(dominio: string) {
    return this.prisma.tenantDominio.findUnique({ where: { dominio } });
  }

  /** Usado por el endpoint público de resolución — solo dominios ya activados sirven la tienda. */
  buscarActivoPorDominio(dominio: string) {
    return this.prisma.tenantDominio.findFirst({
      where: { dominio, estado: 'ACTIVO' },
      include: { tenant: { select: { subdominio: true } } },
    });
  }

  crear(tenantId: string, dominio: string) {
    return this.prisma.tenantDominio.create({ data: { tenantId, dominio } });
  }

  actualizarEstado(
    id: string,
    data: {
      estado: EstadoDominioTenant;
      mensajeError?: string | null;
      npmProxyHostId?: number | null;
      npmCertificadoId?: number | null;
      activadoEn?: Date | null;
    },
  ) {
    return this.prisma.tenantDominio.update({ where: { id }, data });
  }

  eliminar(id: string) {
    return this.prisma.tenantDominio.delete({ where: { id } });
  }
}
