import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FormatoImpresion, MotivoAjusteInventario, Prisma, TipoMovimientoInventario } from '@prisma/client';

/** Un lote a acreditar en una entrada (recepción de compra, ajuste positivo, o reconstruido por una Nota de Crédito — Fase 5b). */
export interface LoteEntrada {
  numeroLote: string;
  fechaVencimiento: Date;
  cantidad: number;
}

/** Cuánto se tomó de cada lote al resolver una salida (FEFO o explícito) — Fase 5b. */
export interface ConsumoLote {
  loteId: string;
  numeroLote: string;
  fechaVencimiento: Date;
  cantidad: number;
}

interface ParamsAjuste {
  tenantId: string;
  productoId: string;
  varianteId: string;
  bodegaId: string;
  delta: number;
  tipo: TipoMovimientoInventario;
  userId: string;
  motivo?: string;
  // Solo la seteamos en ajustes manuales (InventarioService.ajustarStock) — ver ParamsAjuste como el único consumidor real.
  motivoAjuste?: MotivoAjusteInventario;
  referenciaTipo?: string;
  referenciaId?: string;
  // Fase 5b — solo si el producto de `varianteId` tiene `controlaVencimiento: true`.
  controlaVencimiento?: boolean;
  // `delta >= 0` (entrada/ajuste positivo): lote(s) a acreditar, obligatorio si controla vencimiento.
  lotesEntrada?: LoteEntrada[];
  // `delta < 0` (ajuste negativo manual): lote explícito del que sale — nunca FEFO acá, es una corrección manual.
  loteIdSalida?: string;
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
  referenciaTipo?: string;
  referenciaId?: string;
  // Fase 5b — solo si el producto de `varianteId` tiene `controlaVencimiento: true`.
  controlaVencimiento?: boolean;
  // Lote explícito (devolución a proveedor) — si se omite y controla vencimiento, FEFO automático.
  loteId?: string;
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

const EPSILON_LOTE = 0.0001;

@Injectable()
export class InventarioRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /**
   * FEFO ("first expired, first out"): recorre los lotes de esa
   * variante+bodega con saldo, ordenados por vencimiento más próximo
   * primero, y descuenta hasta cubrir `cantidad` — repartiendo entre
   * varios lotes si el primero no alcanza (Fase 5b, decisión explícita
   * del usuario: la venta consume sola, sin que el cajero elija nada).
   * Cada `tx.lote.update` toma su propio row lock — dos consumos
   * concurrentes sobre el mismo lote se serializan igual que ya hace
   * `descontarStockCondicionalEnTx` sobre `Stock` (ver su comentario).
   */
  private async consumirLotesFefoEnTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    varianteId: string,
    bodegaId: string,
    cantidad: number,
  ): Promise<ConsumoLote[]> {
    const lotes = await tx.lote.findMany({
      where: { tenantId, varianteId, bodegaId, cantidadActual: { gt: 0 } },
      orderBy: { fechaVencimiento: 'asc' },
    });

    const consumos: ConsumoLote[] = [];
    let restante = cantidad;
    for (const lote of lotes) {
      if (restante <= EPSILON_LOTE) break;
      const disponible = Number(lote.cantidadActual);
      const tomar = Math.min(disponible, restante);
      if (tomar <= 0) continue;
      await tx.lote.update({ where: { id: lote.id }, data: { cantidadActual: { decrement: tomar } } });
      consumos.push({ loteId: lote.id, numeroLote: lote.numeroLote, fechaVencimiento: lote.fechaVencimiento, cantidad: tomar });
      restante -= tomar;
    }

    if (restante > EPSILON_LOTE) {
      throw new BadRequestException(
        'No hay lotes vigentes suficientes para cubrir esta salida — revisá los lotes de este producto en esta bodega.',
      );
    }
    return consumos;
  }

  /** Lote elegido a mano por el caller (devolución a proveedor, transferencia con lote fijo) — nunca FEFO acá. */
  private async consumirLoteExplicitoEnTx(tx: Prisma.TransactionClient, loteId: string, cantidad: number): Promise<ConsumoLote[]> {
    const lote = await tx.lote.update({ where: { id: loteId }, data: { cantidadActual: { decrement: cantidad } } });
    if (Number(lote.cantidadActual) < -EPSILON_LOTE) {
      throw new BadRequestException(`El lote ${lote.numeroLote} no tiene saldo suficiente para esta salida.`);
    }
    return [{ loteId: lote.id, numeroLote: lote.numeroLote, fechaVencimiento: lote.fechaVencimiento, cantidad }];
  }

  /** Crea el lote si es la primera vez que entra ese `numeroLote` en esta variante+bodega, o suma si ya existía. */
  private upsertLoteEnTx(tx: Prisma.TransactionClient, tenantId: string, varianteId: string, bodegaId: string, lote: LoteEntrada) {
    return tx.lote.upsert({
      where: { tenantId_varianteId_bodegaId_numeroLote: { tenantId, varianteId, bodegaId, numeroLote: lote.numeroLote } },
      create: { tenantId, varianteId, bodegaId, numeroLote: lote.numeroLote, fechaVencimiento: lote.fechaVencimiento, cantidadActual: lote.cantidad },
      update: { cantidadActual: { increment: lote.cantidad } },
    });
  }

  /** Lotes con saldo de una variante+bodega — para el selector de "de qué lote sale" (devolución a proveedor, ajuste manual negativo). */
  listarLotesConSaldo(varianteId: string, bodegaId: string) {
    return this.db.lote.findMany({ where: { varianteId, bodegaId, cantidadActual: { gt: 0 } }, orderBy: { fechaVencimiento: 'asc' } });
  }

  /** Lotes con saldo próximos a vencer, todas las bodegas del tenant (Patrón A de reportes/: sin paginar). */
  lotesPorVencer(diasProximidad: number) {
    const limite = new Date();
    limite.setDate(limite.getDate() + diasProximidad);
    return this.db.lote.findMany({
      where: { cantidadActual: { gt: 0 }, fechaVencimiento: { lte: limite } },
      include: { variante: { include: { producto: true } }, bodega: true },
      orderBy: { fechaVencimiento: 'asc' },
    });
  }

  /**
   * Reconstruye de qué lote(s) salió una venta para esta variante,
   * repartiendo la cantidad devuelta proporcionalmente a como se
   * consumió originalmente — usado por Nota de Crédito para no
   * pedirle nada al usuario (ver FacturacionService.crear,
   * ARCHITECTURE.md "Vencimientos"). Limitación conocida: no descuenta
   * lo ya devuelto por notas de crédito PREVIAS contra la misma
   * factura+producto, así que una tercera devolución parcial (rara)
   * puede repartir levemente distinto de lo ideal — el total devuelto
   * siempre es el correcto, solo cambia a qué lote se acredita.
   */
  async reconstruirLotesDeVentaEnTx(
    tx: Prisma.TransactionClient,
    facturaOrigenId: string,
    varianteId: string,
    cantidadADevolver: number,
  ): Promise<LoteEntrada[]> {
    // `tx`, NO `this.db` — se llama DENTRO de la transacción de
    // FacturacionService.crear() (NOTA_CREDITO); usar el cliente
    // top-level cae en otra conexión sin el SET LOCAL de RLS de esa
    // transacción y la query vuelve 0 filas (bug real, ver
    // ARCHITECTURE.md / InventarioService.validarPertenencia).
    const consumosOriginales = await tx.movimientoInventario.findMany({
      where: { referenciaTipo: 'FACTURA', referenciaId: facturaOrigenId, varianteId, direccion: 'SALIDA', loteId: { not: null } },
      include: { lote: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalOriginal = consumosOriginales.reduce((acc, m) => acc + Number(m.cantidad), 0);
    if (totalOriginal <= 0) {
      throw new BadRequestException('No se encontró de qué lote salió la venta original de este producto — no se puede reintegrar automáticamente.');
    }

    return consumosOriginales.map((m) => ({
      numeroLote: m.lote!.numeroLote,
      fechaVencimiento: m.lote!.fechaVencimiento,
      cantidad: (Number(m.cantidad) / totalOriginal) * cantidadADevolver,
    }));
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
    const { tenantId, productoId, varianteId, bodegaId, delta, tipo, userId, motivo, motivoAjuste, referenciaTipo, referenciaId, controlaVencimiento, lotesEntrada, loteIdSalida } = params;
    const direccion = delta >= 0 ? 'ENTRADA' : 'SALIDA';

    const stock = await tx.stock.upsert({
      where: { varianteId_bodegaId: { varianteId, bodegaId } },
      create: { varianteId, bodegaId, cantidadActual: Math.max(delta, 0) },
      update: { cantidadActual: { increment: delta } },
    });

    if (!controlaVencimiento) {
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
          direccion,
          cantidad: Math.abs(delta),
          motivo,
          motivoAjuste,
          referenciaTipo,
          referenciaId,
          userId,
        },
      });
      return stock;
    }

    // Fase 5b — un movimiento POR LOTE tocado (no uno agregado): la suma da
    // el total, y así el Kardex/reconstrucción de Nota de Crédito ya
    // quedan granulares a nivel de lote sin tabla adicional.
    if (delta >= 0) {
      if (!lotesEntrada?.length) {
        throw new BadRequestException('Este producto controla vencimiento — indicá el lote (número y fecha de vencimiento).');
      }
      for (const l of lotesEntrada) {
        const lote = await this.upsertLoteEnTx(tx, tenantId, varianteId, bodegaId, l);
        await tx.movimientoInventario.create({
          data: { tenantId, productoId, varianteId, bodegaId, tipo, direccion: 'ENTRADA', cantidad: l.cantidad, motivo, motivoAjuste, referenciaTipo, referenciaId, loteId: lote.id, userId },
        });
      }
    } else {
      if (!loteIdSalida) {
        throw new BadRequestException('Este producto controla vencimiento — indicá de qué lote sale.');
      }
      const [consumo] = await this.consumirLoteExplicitoEnTx(tx, loteIdSalida, Math.abs(delta));
      await tx.movimientoInventario.create({
        data: { tenantId, productoId, varianteId, bodegaId, tipo, direccion: 'SALIDA', cantidad: consumo.cantidad, motivo, motivoAjuste, referenciaTipo, referenciaId, loteId: consumo.loteId, userId },
      });
    }

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
    const { tenantId, productoId, varianteId, bodegaId, cantidad, tipo, userId, motivo, referenciaTipo, referenciaId, controlaVencimiento, loteId } = params;

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

    if (!controlaVencimiento) {
      await tx.movimientoInventario.create({
        // Siempre SALIDA — este método, por definición, solo resta (ver
        // comentario de `ajustarCantidadEnTx` sobre por qué `tipo` solo no
        // alcanza para reconstruir el signo).
        data: { tenantId, productoId, varianteId, bodegaId, tipo, direccion: 'SALIDA', cantidad, motivo, referenciaTipo, referenciaId, userId },
      });
      return { ...stock, consumos: [] as ConsumoLote[] };
    }

    // Fase 5b — FEFO automático salvo `loteId` explícito (devolución a
    // proveedor / transferencia interno); un movimiento POR LOTE tocado.
    const consumos = loteId
      ? await this.consumirLoteExplicitoEnTx(tx, loteId, cantidad)
      : await this.consumirLotesFefoEnTx(tx, tenantId, varianteId, bodegaId, cantidad);

    for (const c of consumos) {
      await tx.movimientoInventario.create({
        data: { tenantId, productoId, varianteId, bodegaId, tipo, direccion: 'SALIDA', cantidad: c.cantidad, motivo, referenciaTipo, referenciaId, loteId: c.loteId, userId },
      });
    }

    return { ...stock, consumos };
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
    controlaVencimiento?: boolean;
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
        controlaVencimiento: params.controlaVencimiento,
      });
      if (!origen) {
        throw new BadRequestException(
          `Stock insuficiente en la bodega de origen para transferir el producto ${params.productoId}`,
        );
      }
      // El lote (número + vencimiento) viaja intacto a la bodega destino —
      // FEFO ya decidió en origen de cuál(es) sale, acá solo se preserva su
      // identidad (Fase 5b).
      return this.ajustarCantidadEnTx(tx, {
        tenantId: params.tenantId,
        productoId: params.productoId,
        varianteId: params.varianteId,
        bodegaId: params.bodegaDestinoId,
        delta: params.cantidad,
        tipo: 'TRANSFERENCIA',
        userId: params.userId,
        motivo: `Transferencia desde bodega ${params.bodegaOrigenId}`,
        controlaVencimiento: params.controlaVencimiento,
        lotesEntrada: origen.consumos.map((c) => ({ numeroLote: c.numeroLote, fechaVencimiento: c.fechaVencimiento, cantidad: c.cantidad })),
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

  crearBodega(tenantId: string, sucursalId: string, nombre: string, direccion?: string) {
    return this.db.bodega.create({ data: { tenantId, sucursalId, nombre, direccion } });
  }

  actualizarBodega(id: string, data: { formatoImpresion?: FormatoImpresion | null }) {
    return this.db.bodega.update({ where: { id }, data });
  }
}
