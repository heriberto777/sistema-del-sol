import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class PreciosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  vigente(productoId: string, listaPrecio = 'GENERAL') {
    return this.db.precio.findFirst({
      where: { productoId, listaPrecio, vigenteHasta: null },
    });
  }

  historial(productoId: string, listaPrecio = 'GENERAL') {
    return this.db.precio.findMany({
      where: { productoId, listaPrecio },
      orderBy: { vigenteDesde: 'desc' },
    });
  }

  async crear(params: { productoId: string; listaPrecio: string; costo: number; margenPct: number; precioVenta: number }) {
    return this.db.$transaction(async (tx) => {
      await tx.precio.updateMany({
        where: { productoId: params.productoId, listaPrecio: params.listaPrecio, vigenteHasta: null },
        data: { vigenteHasta: new Date() },
      });

      return tx.precio.create({
        data: {
          productoId: params.productoId,
          listaPrecio: params.listaPrecio,
          costo: params.costo,
          margenPct: params.margenPct,
          precioVenta: params.precioVenta,
        },
      });
    });
  }
}
