import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FormatoImpresion, Prisma, TipoMovimientoInventario } from '@prisma/client';

interface ParamsAjuste {
  tenantId: string;
  productoId: string;
  bodegaId: string;
  delta: number;
  tipo: TipoMovimientoInventario;
  userId: string;
  motivo?: string;
}

interface ParamsDescuento {
  tenantId: string;
  productoId: string;
  bodegaId: string;
  cantidad: number;
  tipo: TipoMovimientoInventario;
  userId: string;
  motivo?: string;
}

interface StockRow {
  id: string;
  productoId: string;
  bodegaId: string;
  cantidadActual: Prisma.Decimal;
  cantidadReservada: Prisma.Decimal;
  stockMinimo: Prisma.Decimal;
  updatedAt: Date;
}

@Injectable()
export class InventarioRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** Lanza (404) si la bodega no existe o no pertenece al tenant actual — Bodega es un modelo tenant-scoped, TenantPrismaService inyecta el filtro. */
  buscarBodegaPorId(id: string) {
    return this.db.bodega.findUniqueOrThrow({ where: { id } });
  }

  /** Ver ProductosRepository.buscarPorIdEnTx — misma razón: participar del `tx` para que el SET LOCAL de RLS cubra esta consulta. */
  buscarBodegaPorIdEnTx(tx: Prisma.TransactionClient, id: string) {
    return tx.bodega.findUniqueOrThrow({ where: { id } });
  }

  obtenerStock(productoId: string, bodegaId: string) {
    return this.db.stock.findUnique({ where: { productoId_bodegaId: { productoId, bodegaId } } });
  }

  listarStockPorBodega(bodegaId: string) {
    return this.db.stock.findMany({ where: { bodegaId }, include: { producto: true } });
  }

  /**
   * Cuerpo puro (sin abrir transacción propia) — usado por `ajustarCantidad`
   * (un solo movimiento), por `transferir` (dos movimientos todo-o-nada), y
   * públicamente por `InventarioService.*EnTx` cuando quien orquesta la
   * transacción es OTRO servicio (ver FacturacionService.crear/anular, que
   * necesita que el descuento de stock, el consumo de NCF y la creación de
   * la factura compartan una sola transacción).
   */
  async ajustarCantidadEnTx(tx: Prisma.TransactionClient, params: ParamsAjuste) {
    const { tenantId, productoId, bodegaId, delta, tipo, userId, motivo } = params;

    const stock = await tx.stock.upsert({
      where: { productoId_bodegaId: { productoId, bodegaId } },
      create: { productoId, bodegaId, cantidadActual: Math.max(delta, 0) },
      update: { cantidadActual: { increment: delta } },
    });

    await tx.movimientoInventario.create({
      data: { tenantId, productoId, bodegaId, tipo, cantidad: Math.abs(delta), motivo, userId },
    });

    return stock;
  }

  ajustarCantidad(params: ParamsAjuste) {
    return this.db.$transaction((tx) => this.ajustarCantidadEnTx(tx, params));
  }

  /**
   * Resta stock solo si hay disponible suficiente, en una única sentencia
   * `UPDATE` condicional — reemplaza el patrón anterior de "leer
   * `cantidadActual`/`cantidadReservada`, decidir en JS, y recién después
   * `UPDATE`", que dejaba una ventana entre el `SELECT` y el `UPDATE` sin
   * ningún lock: dos descuentos concurrentes sobre el mismo producto/
   * bodega podían ambos leer "disponible" y ambos restar, dejando
   * `cantidadActual` negativo (TOCTOU real, ver docs/ARCHITECTURE.md).
   *
   * Postgres toma el lock de fila al ejecutar el `UPDATE`; si dos
   * transacciones concurrentes intentan restar la misma fila, la segunda
   * espera a que la primera termine y su `WHERE` se reevalúa contra el
   * valor YA actualizado por la primera — por eso esto cierra la ventana
   * de carrera, no solo la reduce. Devuelve `null` (sin lanzar) si no
   * alcanza — el caller decide el mensaje/excepción.
   */
  async descontarStockCondicionalEnTx(tx: Prisma.TransactionClient, params: ParamsDescuento) {
    const { tenantId, productoId, bodegaId, cantidad, tipo, userId, motivo } = params;

    const filas = await tx.$queryRaw<StockRow[]>`
      UPDATE stock
      SET "cantidadActual" = "cantidadActual" - ${cantidad}, "updatedAt" = now()
      WHERE "productoId" = ${productoId} AND "bodegaId" = ${bodegaId}
        AND ("cantidadActual" - "cantidadReservada") >= ${cantidad}
      RETURNING *
    `;
    const stock = filas[0];
    if (!stock) {
      return null;
    }

    await tx.movimientoInventario.create({
      data: { tenantId, productoId, bodegaId, tipo, cantidad, motivo, userId },
    });

    return stock;
  }

  descontarStockCondicional(params: ParamsDescuento) {
    return this.db.$transaction((tx) => this.descontarStockCondicionalEnTx(tx, params));
  }

  /**
   * Resta en la bodega origen y suma en la destino dentro de UNA sola
   * transacción — antes eran dos llamadas a `ajustarCantidad` con su
   * propia transacción cada una: si la resta en origen tenía éxito y la
   * suma en destino fallaba (error de red, timeout, restart del proceso),
   * el producto quedaba descontado del origen sin acreditarse en ningún
   * lado — inventario perdido de verdad, no solo un dato inconsistente.
   *
   * El lado origen usa `descontarStockCondicionalEnTx` (antes usaba
   * `ajustarCantidadEnTx` con delta negativo, que resta sin validar nada):
   * sin el chequeo, una transferencia podía dejar `cantidadActual`
   * negativo en la bodega origen incluso sin concurrencia de por medio.
   */
  async transferir(params: { tenantId: string; productoId: string; bodegaOrigenId: string; bodegaDestinoId: string; cantidad: number; userId: string }) {
    return this.db.$transaction(async (tx) => {
      const origen = await this.descontarStockCondicionalEnTx(tx, {
        tenantId: params.tenantId,
        productoId: params.productoId,
        bodegaId: params.bodegaOrigenId,
        cantidad: params.cantidad,
        tipo: 'TRANSFERENCIA',
        userId: params.userId,
        motivo: `Transferencia hacia bodega ${params.bodegaDestinoId}`,
      });
      if (!origen) {
        throw new BadRequestException(
          `Stock insuficiente en la bodega de origen para transferir el producto ${params.productoId}`,
        );
      }
      return this.ajustarCantidadEnTx(tx, {
        tenantId: params.tenantId,
        productoId: params.productoId,
        bodegaId: params.bodegaDestinoId,
        delta: params.cantidad,
        tipo: 'TRANSFERENCIA',
        userId: params.userId,
        motivo: `Transferencia desde bodega ${params.bodegaOrigenId}`,
      });
    });
  }

  listarBodegas() {
    return this.db.bodega.findMany({ where: { activa: true } });
  }

  crearBodega(tenantId: string, nombre: string, direccion?: string) {
    return this.db.bodega.create({ data: { tenantId, nombre, direccion } });
  }

  actualizarBodega(id: string, data: { formatoImpresion?: FormatoImpresion | null }) {
    return this.db.bodega.update({ where: { id }, data });
  }
}
