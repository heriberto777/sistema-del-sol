import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class PreciosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** Precio cuelga de VarianteProducto desde la Fase 3c — `varianteId` ya viene resuelto por `PreciosService` (ver `VariantesService.resolverObligatoria`, que exige elegir variante explícita cuando el producto tiene más de una). */
  vigente(varianteId: string, listaPrecio = 'GENERAL') {
    return this.db.precio.findFirst({
      where: { varianteId, listaPrecio, vigenteHasta: null },
    });
  }

  historial(varianteId: string, listaPrecio = 'GENERAL') {
    return this.db.precio.findMany({
      where: { varianteId, listaPrecio },
      orderBy: { vigenteDesde: 'desc' },
    });
  }

  async crear(params: { varianteId: string; listaPrecio: string; costo: number; margenPct: number; precioVenta: number }) {
    return this.db.$transaction(async (tx) => {
      await tx.precio.updateMany({
        where: { varianteId: params.varianteId, listaPrecio: params.listaPrecio, vigenteHasta: null },
        data: { vigenteHasta: new Date() },
      });

      return tx.precio.create({
        data: {
          varianteId: params.varianteId,
          listaPrecio: params.listaPrecio,
          costo: params.costo,
          margenPct: params.margenPct,
          precioVenta: params.precioVenta,
        },
      });
    });
  }
}
