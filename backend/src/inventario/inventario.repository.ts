import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { Prisma, TipoMovimientoInventario } from '@prisma/client';

interface ParamsAjuste {
  tenantId: string;
  productoId: string;
  bodegaId: string;
  delta: number;
  tipo: TipoMovimientoInventario;
  userId: string;
  motivo?: string;
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
   * Resta en la bodega origen y suma en la destino dentro de UNA sola
   * transacción — antes eran dos llamadas a `ajustarCantidad` con su
   * propia transacción cada una: si la resta en origen tenía éxito y la
   * suma en destino fallaba (error de red, timeout, restart del proceso),
   * el producto quedaba descontado del origen sin acreditarse en ningún
   * lado — inventario perdido de verdad, no solo un dato inconsistente.
   */
  transferir(params: { tenantId: string; productoId: string; bodegaOrigenId: string; bodegaDestinoId: string; cantidad: number; userId: string }) {
    return this.db.$transaction(async (tx) => {
      await this.ajustarCantidadEnTx(tx, {
        tenantId: params.tenantId,
        productoId: params.productoId,
        bodegaId: params.bodegaOrigenId,
        delta: -params.cantidad,
        tipo: 'TRANSFERENCIA',
        userId: params.userId,
        motivo: `Transferencia hacia bodega ${params.bodegaDestinoId}`,
      });
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
}
