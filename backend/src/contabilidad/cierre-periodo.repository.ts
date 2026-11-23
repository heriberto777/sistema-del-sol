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

  /** El de `fechaInicio` más reciente — no necesariamente ABIERTO (si el cron se atrasó, puede que el último exista y ya esté cerrado, o no exista ninguno que cubra hoy). Base para `completarFaltantes`. */
  buscarMasReciente() {
    return this.db.periodoContable.findFirst({ orderBy: { fechaInicio: 'desc' } });
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
