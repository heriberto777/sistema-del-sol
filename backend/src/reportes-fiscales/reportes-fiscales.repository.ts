import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';

function finDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

@Injectable()
export class ReportesFiscalesRepository {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  ventasEnRango(desde: Date, hasta: Date) {
    return this.db.factura.findMany({
      where: { estado: 'EMITIDA', fecha: { gte: desde, lte: finDelDia(hasta) } },
      orderBy: { fecha: 'asc' },
      include: { cliente: true },
    });
  }

  anuladasEnRango(desde: Date, hasta: Date) {
    return this.db.factura.findMany({
      where: { estado: 'ANULADA', fecha: { gte: desde, lte: finDelDia(hasta) } },
      orderBy: { fecha: 'asc' },
    });
  }

  comprasRecibidasEnRango(desde: Date, hasta: Date) {
    return this.db.recepcionCompra.findMany({
      where: { fecha: { gte: desde, lte: finDelDia(hasta) } },
      orderBy: { fecha: 'asc' },
      include: {
        ordenCompra: { include: { proveedor: true } },
        lineas: { include: { producto: true } },
      },
    });
  }

  /** Comprobantes de compra al mercado informal (NCF B11/E43) — también van al 606, sin RNC de proveedor. */
  gastosMenoresEnRango(desde: Date, hasta: Date) {
    return this.db.gastoMenor.findMany({
      where: { fecha: { gte: desde, lte: finDelDia(hasta) } },
      orderBy: { fecha: 'asc' },
      include: { lineas: true },
    });
  }

  /**
   * ReciboNomina no tiene columna tenantId propia (ver tenant-scoped-models.ts)
   * y acá no llegamos a través del id de un período ya validado — por eso se
   * usa el cliente global y se filtra el tenant a mano vía la relación
   * `periodo`, en vez de `this.db` (que no inyectaría nada para este modelo).
   */
  retencionesNominaEnRango(tenantId: string, desde: Date, hasta: Date) {
    return this.prisma.reciboNomina.findMany({
      where: { periodo: { tenantId, fechaFin: { gte: desde, lte: finDelDia(hasta) } } },
      include: { empleado: true, periodo: true },
      orderBy: { periodo: { fechaFin: 'asc' } },
    });
  }
}
