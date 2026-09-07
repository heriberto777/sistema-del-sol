import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const INCLUDE_BUSQUEDA = {
  producto: { select: { id: true, nombre: true, codigo: true } },
  valoresAtributo: { include: { valorAtributo: { include: { atributo: true } } } },
} as const;

@Injectable()
export class VariantesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** `bodegaId`: además de los atributos, trae el `Stock` de esa bodega puntual (ver VariantesService.listarPorProducto — resuelve `existencia` a partir de esto). */
  listarPorProducto(productoId: string, bodegaId?: string) {
    return this.db.varianteProducto.findMany({
      where: { productoId },
      include: {
        valoresAtributo: { include: { valorAtributo: { include: { atributo: true } } } },
        ...(bodegaId ? { stock: { where: { bodegaId } } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Versión liviana (sin includes) para la resolución obligatoria de variante en los flujos de venta/compra — ver VariantesService.resolverObligatoria. */
  listarIdsPorProducto(productoId: string) {
    return this.db.varianteProducto.findMany({ where: { productoId }, select: { id: true }, orderBy: { createdAt: 'asc' } });
  }

  /** `codigoBarras: null` explícito quita el código asignado — ver ProductosRepository.whereBusqueda (Fase 3d). */
  actualizarCodigoBarras(id: string, codigoBarras: string | null) {
    return this.db.varianteProducto.update({ where: { id }, data: { codigoBarras } });
  }

  /** Participa en la transacción del correlativo (`VariantesService.generarCodigoBarras`) — todo o nada. */
  actualizarCodigoBarrasEnTx(tx: Prisma.TransactionClient, id: string, codigoBarras: string) {
    return tx.varianteProducto.update({ where: { id }, data: { codigoBarras } });
  }

  /**
   * Búsqueda de variantes A TRAVÉS DE TODO EL CATÁLOGO del tenant (no
   * acotada a un producto ni a una bodega) — para la pantalla de
   * impresión masiva de etiquetas (`EtiquetasCodigoBarras.tsx`), que
   * necesita juntar variantes de productos distintos en una sola
   * selección. Solo `tipo: 'PRODUCTO'` — un SERVICIO/COMBO no tiene
   * sentido como etiqueta física (mismo criterio ya usado en Conteo
   * Físico). Aplana `valoresAtributo` igual que
   * `ConteoFisicoRepository`/`InventarioRepository.listarStockPorBodega`
   * — nunca se spreadea el resto de campos de `VarianteProducto` sobre
   * la fila.
   */
  async buscarEnCatalogo(params: { skip: number; take: number; busqueda?: string }) {
    const where = {
      producto: { tipo: 'PRODUCTO' as const },
      ...(params.busqueda
        ? {
            OR: [
              { producto: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
              { producto: { codigo: { contains: params.busqueda, mode: 'insensitive' as const } } },
              { sku: { contains: params.busqueda, mode: 'insensitive' as const } },
              { codigoBarras: { contains: params.busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [filas, total] = await Promise.all([
      this.db.varianteProducto.findMany({
        where,
        include: INCLUDE_BUSQUEDA,
        orderBy: { producto: { nombre: 'asc' } },
        skip: params.skip,
        take: params.take,
      }),
      this.db.varianteProducto.count({ where }),
    ]);
    const datos = filas.map(({ producto, valoresAtributo, ...variante }) => ({
      ...variante,
      producto,
      valoresAtributo: valoresAtributo.map((va) => ({ atributo: va.valorAtributo.atributo.nombre, valor: va.valorAtributo.valor })),
    }));
    return [datos, total] as const;
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
