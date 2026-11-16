import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class CierrePeriodoRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listar() {
    return this.db.periodoContable.findMany({ orderBy: { fechaInicio: 'desc' }, include: { asientoCierre: { include: { lineas: true } } } });
  }

  buscarPorFecha(fecha: Date) {
    return this.db.periodoContable.findFirst({ where: { fechaInicio: { lte: fecha }, fechaFin: { gte: fecha } } });
  }

  buscarAbiertoMasAntiguo() {
    return this.db.periodoContable.findFirst({ where: { estado: 'ABIERTO' }, orderBy: { fechaInicio: 'asc' } });
  }

  crear(params: { tenantId: string; fechaInicio: Date; fechaFin: Date }) {
    return this.db.periodoContable.create({ data: params });
  }

  cerrar(id: string, params: { utilidadNeta: number; asientoCierreId: string }) {
    return this.db.periodoContable.update({
      where: { id },
      data: { estado: 'CERRADO', ...params },
      include: { asientoCierre: { include: { lineas: true } } },
    });
  }
}
