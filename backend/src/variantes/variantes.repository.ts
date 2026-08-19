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

  /** Versión liviana (sin includes) para la resolución obligatoria de variante en los flujos de venta/compra — ver VariantesService.resolverObligatoria. */
  listarIdsPorProducto(productoId: string) {
    return this.db.varianteProducto.findMany({ where: { productoId }, select: { id: true }, orderBy: { createdAt: 'asc' } });
  }

  contarMovimientos(varianteIds: string[]) {
    if (!varianteIds.length) return Promise.resolve(0);
    return this.db.movimientoInventario.count({ where: { varianteId: { in: varianteIds } } });
  }

  /**
   * Además de `MovimientoInventario` (Restrict), las líneas de venta/compra
   * (Fase 3c, incremento 3) también referencian la variante con Restrict —
   * cotizaciones/remisiones/OC nunca generan un movimiento de inventario
   * (documentos sin efecto de stock), así que sin este chequeo adicional
   * regenerar variantes sobre un producto ya cotizado/remitido/ordenado
   * fallaría con una violación de FK cruda en vez de un 400 claro.
   */
  async contarUsoEnLineas(varianteIds: string[]) {
    if (!varianteIds.length) return 0;
    const where = { varianteId: { in: varianteIds } };
    const conteos = await Promise.all([
      this.db.lineaFactura.count({ where }),
      this.db.lineaCotizacion.count({ where }),
      this.db.lineaRemision.count({ where }),
      this.db.lineaOc.count({ where }),
      this.db.lineaRecepcion.count({ where }),
      this.db.lineaDevolucionCompra.count({ where }),
      this.db.ventaAparcadaLinea.count({ where }),
    ]);
    return conteos.reduce((acc, c) => acc + c, 0);
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
