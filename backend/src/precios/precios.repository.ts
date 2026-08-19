import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class PreciosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /**
   * Precio cuelga de VarianteProducto desde la Fase 3c — mientras un
   * producto no tenga atributos reales (ver ARCHITECTURE.md), tiene
   * exactamente una variante "por defecto", que es la que resuelve este
   * helper. Los métodos públicos de este repositorio siguen recibiendo
   * `productoId` sin cambios para no tocar `PreciosService`/controller.
   */
  private resolverVarianteDefault(productoId: string) {
    return this.db.varianteProducto.findFirstOrThrow({ where: { productoId }, orderBy: { createdAt: 'asc' } });
  }

  async vigente(productoId: string, listaPrecio = 'GENERAL') {
    const variante = await this.resolverVarianteDefault(productoId);
    return this.db.precio.findFirst({
      where: { varianteId: variante.id, listaPrecio, vigenteHasta: null },
    });
  }

  async historial(productoId: string, listaPrecio = 'GENERAL') {
    const variante = await this.resolverVarianteDefault(productoId);
    return this.db.precio.findMany({
      where: { varianteId: variante.id, listaPrecio },
      orderBy: { vigenteDesde: 'desc' },
    });
  }

  async crear(params: { productoId: string; listaPrecio: string; costo: number; margenPct: number; precioVenta: number }) {
    return this.db.$transaction(async (tx) => {
      const variante = await tx.varianteProducto.findFirstOrThrow({
        where: { productoId: params.productoId },
        orderBy: { createdAt: 'asc' },
      });

      await tx.precio.updateMany({
        where: { varianteId: variante.id, listaPrecio: params.listaPrecio, vigenteHasta: null },
        data: { vigenteHasta: new Date() },
      });

      return tx.precio.create({
        data: {
          varianteId: variante.id,
          listaPrecio: params.listaPrecio,
          costo: params.costo,
          margenPct: params.margenPct,
          precioVenta: params.precioVenta,
        },
      });
    });
  }
}
