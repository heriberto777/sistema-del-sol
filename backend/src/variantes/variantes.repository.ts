import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class VariantesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listarPorProducto(productoId: string) {
    return this.db.varianteProducto.findMany({
      where: { productoId },
      include: { valoresAtributo: { include: { valorAtributo: { include: { atributo: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  contarMovimientos(varianteIds: string[]) {
    if (!varianteIds.length) return Promise.resolve(0);
    return this.db.movimientoInventario.count({ where: { varianteId: { in: varianteIds } } });
  }

  /**
   * "Borrar todo y recrear" — mismo patrón que `ProductosRepository.
   * actualizar()` ya usa para `ComponenteCombo`. Precio/Stock cuelgan de
   * VarianteProducto con `onDelete: Cascade`, así que se pierden junto
   * con la variante vieja (aceptable: `VariantesService.
   * generarCombinaciones` ya validó que ninguna variante a borrar tiene
   * movimientos de inventario, así que no hay historial real que perder).
   */
  async regenerar(productoId: string, tenantId: string, combinaciones: string[][]) {
    return this.db.$transaction(async (tx) => {
      await tx.varianteProducto.deleteMany({ where: { productoId } });
      const creadas = [];
      for (const combinacion of combinaciones) {
        const variante = await tx.varianteProducto.create({ data: { productoId, tenantId } });
        if (combinacion.length) {
          await tx.valorAtributoVariante.createMany({
            data: combinacion.map((valorAtributoId) => ({ varianteId: variante.id, valorAtributoId })),
          });
        }
        creadas.push(variante);
      }
      return creadas;
    });
  }
}
