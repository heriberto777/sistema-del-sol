import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * Lee Cotizacion/Factura directo (sin pasar por CotizacionesService/
 * FacturacionService) — es una vista de solo lectura cross-dominio, mismo
 * criterio que ReportesRepository. TenantPrismaService ya scopea por
 * tenant, así que no hay riesgo de fuga entre tenants.
 */
@Injectable()
export class ClienteTimelineRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  cotizacionesRecientes(clienteId: string, take = 20) {
    return this.db.cotizacion.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, numero: true, estado: true, total: true, createdAt: true },
    });
  }

  facturasRecientes(clienteId: string, take = 20) {
    return this.db.factura.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, numero: true, estado: true, total: true, createdAt: true },
    });
  }
}
