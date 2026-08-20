import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FormatoImpresion, Prisma, TipoMovimientoInventario } from '@prisma/client';

interface ParamsAjuste {
  tenantId: string;
  productoId: string;
  varianteId: string;
  bodegaId: string;
  delta: number;
  tipo: TipoMovimientoInventario;
  userId: string;
  motivo?: string;
}

interface ParamsDescuento {
  tenantId: string;
  productoId: string;
  varianteId: string;
  bodegaId: string;
  cantidad: number;
  tipo: TipoMovimientoInventario;
  userId: string;
  motivo?: string;
}

interface StockRow {
  id: string;
  varianteId: string;
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

  /** Stock cuelga de VarianteProducto desde la Fase 3c — `varianteId` ya viene resuelto por `InventarioService` (ver `VariantesService.resolverObligatoria`, incremento 3). */
  obtenerStock(varianteId: string, bodegaId: string) {
    return this.db.stock.findUnique({ where: { varianteId_bodegaId: { varianteId, bodegaId } } });
  }

  /**
   * Reaplana `variante.producto` a `producto` en cada fila (para que el
   * consumidor no tenga que cambiar), pero expone `varianteId` y sus
   * `valoresAtributo` — Fase 3c, incremento 4: un producto con variantes
   * reales tiene una fila de Stock POR variante, y sin esto la pantalla
   * de Inventario mostraría filas indistinguibles (mismo producto
   * repetido) y no podría ajustar/transferir la variante correcta.
   */
  async listarStockPorBodega(bodegaId: string, params: { skip: number; take: number; busqueda?: string }) {
    const where = {
      bodegaId,
      ...(params.busqueda
        ? {
            variante: {
              producto: {
                OR: [
                  { nombre: { contains: params.busqueda, mode: 'insensitive' as const } },
                  { codigo: { contains: params.busqueda, mode: 'insensitive' as const } },
                ],
              },
            },
          }
        : {}),
    };
    const [filas, total] = await Promise.all([
      this.db.stock.findMany({
        where,
        include: {
          variante: {
            include: {
              producto: true,
              valoresAtributo: { include: { valorAtributo: { include: { atributo: true } } } },
            },
          },
        },
        orderBy: { variante: { producto: { nombre: 'asc' } } },
        skip: params.skip,
        take: params.take,
      }),
      this.db.stock.count({ where }),
    ]);
    const datos = filas.map(({ variante, ...stock }) => ({
      ...stock,
      varianteId: variante.id,
      producto: variante.producto,
      valoresAtributo: variante.valoresAtributo.map((va) => ({
        atributo: va.valorAtributo.atributo.nombre,
        valor: va.valorAtributo.valor,
      })),
    }));
    return [datos, total] as const;
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
    const { tenantId, productoId, varianteId, bodegaId, delta, tipo, userId, motivo } = params;

    const stock = await tx.stock.upsert({
      where: { varianteId_bodegaId: { varianteId, bodegaId } },
      create: { varianteId, bodegaId, cantidadActual: Math.max(delta, 0) },
      update: { cantidadActual: { increment: delta } },
    });

    await tx.movimientoInventario.create({
      data: {
        tenantId,
        productoId,
        varianteId,
        bodegaId,
        tipo,
        // Calculado del signo real de `delta` (no del `tipo`) — `TRANSFERENCIA`
        // se usa para ambos lados de una transferencia y `AJUSTE` puede ser
        // positivo o negativo, así que `tipo` solo no alcanza para el saldo
        // corriente del Kardex (Fase 5a, ver ARCHITECTURE.md).
        direccion: delta >= 0 ? 'ENTRADA' : 'SALIDA',
        cantidad: Math.abs(delta),
        motivo,
        userId,
      },
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
    const { tenantId, productoId, varianteId, bodegaId, cantidad, tipo, userId, motivo } = params;

    const filas = await tx.$queryRaw<StockRow[]>`
      UPDATE stock
      SET "cantidadActual" = "cantidadActual" - ${cantidad}, "updatedAt" = now()
      WHERE "varianteId" = ${varianteId} AND "bodegaId" = ${bodegaId}
        AND ("cantidadActual" - "cantidadReservada") >= ${cantidad}
      RETURNING *
    `;
    const stock = filas[0];
    if (!stock) {
      return null;
    }

    await tx.movimientoInventario.create({
      // Siempre SALIDA — este método, por definición, solo resta (ver
      // comentario de `ajustarCantidadEnTx` sobre por qué `tipo` solo no
      // alcanza para reconstruir el signo).
      data: { tenantId, productoId, varianteId, bodegaId, tipo, direccion: 'SALIDA', cantidad, motivo, userId },
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
  async transferir(params: {
    tenantId: string;
    productoId: string;
    varianteId: string;
    bodegaOrigenId: string;
    bodegaDestinoId: string;
    cantidad: number;
    userId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const origen = await this.descontarStockCondicionalEnTx(tx, {
        tenantId: params.tenantId,
        productoId: params.productoId,
        varianteId: params.varianteId,
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
        varianteId: params.varianteId,
        bodegaId: params.bodegaDestinoId,
        delta: params.cantidad,
        tipo: 'TRANSFERENCIA',
        userId: params.userId,
        motivo: `Transferencia desde bodega ${params.bodegaOrigenId}`,
      });
    });
  }

  /** VarianteProducto es tenant-scoped — `findUniqueOrThrow` vía el cliente con RLS ya da 404 si la variante es de otro tenant, sin validación manual aparte. */
  obtenerVarianteConProducto(varianteId: string) {
    return this.db.varianteProducto.findUniqueOrThrow({ where: { id: varianteId }, include: { producto: true } });
  }

  /** Kardex (Fase 5a) — molde calcado de AsientosContablesRepository.lineasPorCuenta: cronológico hasta `hasta`, el service separa "antes de desde" (saldo inicial) de "dentro del rango". */
  movimientosPorVarianteBodega(varianteId: string, bodegaId: string, hasta: Date) {
    return this.db.movimientoInventario.findMany({
      where: { varianteId, bodegaId, createdAt: { lte: hasta } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
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
