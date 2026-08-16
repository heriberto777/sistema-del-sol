import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class CierrePeriodoRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  buscarUltimo() {
    return this.db.periodoContableCerrado.findFirst({ orderBy: { fecha: 'desc' } });
  }

  listar() {
    return this.db.periodoContableCerrado.findMany({ orderBy: { fecha: 'desc' }, include: { asientoCierre: { include: { lineas: true } } } });
  }

  crear(params: { tenantId: string; fecha: Date; utilidadNeta: number; asientoCierreId: string }) {
    return this.db.periodoContableCerrado.create({ data: params, include: { asientoCierre: { include: { lineas: true } } } });
  }
}
