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

  /** Resuelve un `sucursalId` a los ids de sus bodegas — usado para filtrar Dashboard/Reporte de inventario por sucursal (Fase 8d). */
  async bodegaIdsDeSucursal(sucursalId: string) {
    const bodegas = await this.db.bodega.findMany({ where: { sucursalId }, select: { id: true } });
    return bodegas.map((b) => b.id);
  }

  async ventasDeHoy(bodegaIds?: string[]) {
    const inicio = inicioDelDia();
    const where = { estado: 'EMITIDA' as const, fecha: { gte: inicio }, ...(bodegaIds ? { bodegaId: { in: bodegaIds } } : {}) };
    const [agregado, cantidad] = await Promise.all([
      this.db.factura.aggregate({ where, _sum: { total: true } }),
      this.db.factura.count({ where }),
    ]);
    return { total: Number(agregado._sum.total ?? 0), cantidad };
  }

  /**
   * Stock no lleva tenantId propio (se aísla por su variante→producto, que
   * sí son tenant-scoped), así que TenantPrismaService no lo auto-filtra —
   * hay que filtrar explícitamente por producto.tenantId (Fase 3c: Stock
   * cuelga de VarianteProducto, no directo de Producto).
   */
  async stockBajoConteo(tenantId: string, bodegaIds?: string[]) {
    const stock = await this.db.stock.findMany({
      where: { variante: { producto: { tenantId } }, ...(bodegaIds ? { bodegaId: { in: bodegaIds } } : {}) },
      select: { cantidadActual: true, stockMinimo: true },
    });
    return stock.filter((s) => Number(s.cantidadActual) < Number(s.stockMinimo)).length;
  }

  /** Sin bodegaId en OrdenCompra (solo su RecepcionCompra lo tiene) — no se puede filtrar por sucursal sin un cambio estructural, ver ARCHITECTURE.md. */
  ordenesCompraPendientesConteo() {
    return this.db.ordenCompra.count({
      where: { estado: { in: ['BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL'] } },
    });
  }

  facturasEnRango(desde: Date, hasta: Date, bodegaIds?: string[]) {
    return this.db.factura.findMany({
      where: { estado: 'EMITIDA', fecha: { gte: desde, lte: finDelDia(hasta) }, ...(bodegaIds ? { bodegaId: { in: bodegaIds } } : {}) },
      orderBy: { fecha: 'asc' },
      include: { cliente: true },
    });
  }

  /** Reaplana `variante.producto` a `producto` en cada fila, para que ReportesService no tenga que cambiar. */
  async stockActual(tenantId: string, bodegaIds?: string[]) {
    const filas = await this.db.stock.findMany({
      where: { variante: { producto: { tenantId } }, ...(bodegaIds ? { bodegaId: { in: bodegaIds } } : {}) },
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
