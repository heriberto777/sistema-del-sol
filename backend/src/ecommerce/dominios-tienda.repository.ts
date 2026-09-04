import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * Dominios propios ACTIVOS del tenant actual (ver `TenantDominio`,
 * gestionado exclusivamente por el super admin en `/plataforma/tenants` —
 * ver `backend/src/tenants/tenant-dominios.service.ts`). Acá es de solo
 * lectura, para que el panel "Tienda Online" del tenant pueda mostrar el
 * link real junto al subdominio de ciguadev.com de siempre.
 * `TenantPrismaService` (no el `PrismaService` global que usa el resto de
 * `EcommerceService`) porque esto SÍ corre con sesión de tenant.
 */
@Injectable()
export class DominiosTiendaRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async listarActivos(): Promise<string[]> {
    const filas = await this.tenantPrisma.client.tenantDominio.findMany({
      where: { estado: 'ACTIVO' },
      select: { dominio: true },
      orderBy: { activadoEn: 'asc' },
    });
    return filas.map((f) => f.dominio);
  }
}
