import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

function inicioDelDia(fecha = new Date()): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function finDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

@Injectable()
export class ReportesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  async ventasDeHoy() {
    const inicio = inicioDelDia();
    const [agregado, cantidad] = await Promise.all([
      this.db.factura.aggregate({ where: { estado: 'EMITIDA', fecha: { gte: inicio } }, _sum: { total: true } }),
      this.db.factura.count({ where: { estado: 'EMITIDA', fecha: { gte: inicio } } }),
    ]);
    return { total: Number(agregado._sum.total ?? 0), cantidad };
  }

  /**
   * Stock no lleva tenantId propio (se aísla por su variante→producto, que
   * sí son tenant-scoped), así que TenantPrismaService no lo auto-filtra —
   * hay que filtrar explícitamente por producto.tenantId (Fase 3c: Stock
   * cuelga de VarianteProducto, no directo de Producto).
   */
  async stockBajoConteo(tenantId: string) {
    const stock = await this.db.stock.findMany({
      where: { variante: { producto: { tenantId } } },
      select: { cantidadActual: true, stockMinimo: true },
    });
    return stock.filter((s) => Number(s.cantidadActual) < Number(s.stockMinimo)).length;
  }

  ordenesCompraPendientesConteo() {
    return this.db.ordenCompra.count({
      where: { estado: { in: ['BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL'] } },
    });
  }

  facturasEnRango(desde: Date, hasta: Date) {
    return this.db.factura.findMany({
      where: { estado: 'EMITIDA', fecha: { gte: desde, lte: finDelDia(hasta) } },
      orderBy: { fecha: 'asc' },
      include: { cliente: true },
    });
  }

  /** Reaplana `variante.producto` a `producto` en cada fila, para que ReportesService no tenga que cambiar. */
  async stockActual(tenantId: string) {
    const filas = await this.db.stock.findMany({
      where: { variante: { producto: { tenantId } } },
      include: { variante: { include: { producto: true } }, bodega: true },
      orderBy: [{ bodega: { nombre: 'asc' } }, { variante: { producto: { nombre: 'asc' } } }],
    });
    return filas.map(({ variante, ...stock }) => ({ ...stock, producto: variante.producto }));
  }

  ordenesCompraEnRango(desde: Date, hasta: Date) {
    return this.db.ordenCompra.findMany({
      where: { fecha: { gte: desde, lte: finDelDia(hasta) } },
      orderBy: { fecha: 'asc' },
      include: { proveedor: true },
    });
  }
}
