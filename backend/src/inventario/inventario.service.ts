import { BadRequestException, Injectable } from '@nestjs/common';
import { FormatoImpresion, Prisma } from '@prisma/client';
import { InventarioRepository } from './inventario.repository';
import { ProductosService } from '../productos/productos.service';
import { VariantesService } from '../variantes/variantes.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class InventarioService {
  constructor(
    private readonly inventarioRepository: InventarioRepository,
    private readonly productosService: ProductosService,
    private readonly variantesService: VariantesService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * `Stock` no tiene columna `tenantId` propia (como `Producto`/`Bodega`,
   * de quienes depende) — se aísla validando que el producto/bodega
   * referenciados pertenezcan al tenant actual antes de tocar Stock.
   * `buscarPorId`/`buscarBodegaPorId` usan el cliente de Prisma con
   * aislamiento de tenant (Producto y Bodega SÍ están en
   * TENANT_SCOPED_MODELS), así que lanzan 404 si el id pertenece a OTRO
   * tenant. Sin esto, cualquier bodegaId/productoId adivinado permitía
   * leer/corromper stock de otro negocio (ver ARCHITECTURE.md).
   */
  /**
   * `tx` opcional: cuando quien llama ya está dentro de una transacción
   * abierta (ver `verificarYDescontarStockEnTx`/`entradaStockEnTx`), esta
   * validación tiene que correr sobre ESE MISMO `tx` — no sobre
   * `this.db` (el cliente top-level) — para que el `SET LOCAL` de RLS que
   * esa transacción ya aplicó también cubra esta consulta. Sin esto, la
   * consulta caía en una conexión distinta sin `app.tenant_id` seteado y
   * RLS la bloqueaba (0 filas, 404 "no encontrado") aunque el producto/
   * bodega sí pertenecieran al tenant — bug real encontrado corriendo el
   * e2e contra Postgres con RLS activo, no algo que un mock hubiera
   * detectado.
   */
  private async validarPertenencia(params: { productoId?: string; bodegaId?: string }, tx?: Prisma.TransactionClient) {
    await Promise.all([
      params.productoId
        ? tx
          ? this.productosService.buscarPorIdEnTx(tx, params.productoId)
          : this.productosService.buscarPorId(params.productoId)
        : undefined,
      params.bodegaId
        ? tx
          ? this.inventarioRepository.buscarBodegaPorIdEnTx(tx, params.bodegaId)
          : this.inventarioRepository.buscarBodegaPorId(params.bodegaId)
        : undefined,
    ]);
  }

  /**
   * Regla de negocio: el stock nunca puede quedar negativo. El chequeo de
   * disponible y el descuento ocurren en una sola sentencia `UPDATE`
   * condicional (`InventarioRepository.descontarStockCondicional*`) — antes
   * se leía el disponible, se decidía en JS, y recién después se
   * descontaba, dejando una ventana sin lock entre ambos pasos donde dos
   * descuentos concurrentes podían pasar la validación a la vez (TOCTOU
   * real, ver docs/ARCHITECTURE.md, "Concurrencia y atomicidad").
   */
  async verificarYDescontarStock(params: {
    tenantId: string;
    productoId: string;
    varianteId?: string;
    bodegaId: string;
    cantidad: number;
    userId: string;
    referencia: string;
  }) {
    await this.validarPertenencia({ productoId: params.productoId, bodegaId: params.bodegaId });
    const varianteId = await this.variantesService.resolverObligatoria(params.productoId, params.varianteId);

    const stock = await this.inventarioRepository.descontarStockCondicional({
      tenantId: params.tenantId,
      productoId: params.productoId,
      varianteId,
      bodegaId: params.bodegaId,
      cantidad: params.cantidad,
      tipo: 'SALIDA',
      userId: params.userId,
      motivo: params.referencia,
    });

    if (!stock) {
      await this.lanzarStockInsuficiente(params.productoId, varianteId, params.bodegaId);
    }

    // `lanzarStockInsuficiente` siempre lanza — si llegamos acá, `stock` no es null (TS no infiere
    // la ausencia de retorno a través de un `await` a una función `never`, por eso el `!`).
    this.emitirSiStockBajo(params.tenantId, params.productoId, params.bodegaId, stock!);

    return stock;
  }

  /** Mensaje de error con el disponible real — solo se lee en el camino de error, no afecta la atomicidad del descuento. */
  private async lanzarStockInsuficiente(productoId: string, varianteId: string, bodegaId: string): Promise<never> {
    const stockActual = await this.inventarioRepository.obtenerStock(varianteId, bodegaId);
    const disponible = Number(stockActual?.cantidadActual ?? 0) - Number(stockActual?.cantidadReservada ?? 0);
    throw new BadRequestException(
      `Stock insuficiente para el producto ${productoId} en la bodega ${bodegaId} (disponible: ${disponible})`,
    );
  }

  private emitirSiStockBajo(
    tenantId: string,
    productoId: string,
    bodegaId: string,
    stock: { cantidadActual: Prisma.Decimal; stockMinimo: Prisma.Decimal },
  ) {
    if (Number(stock.cantidadActual) < Number(stock.stockMinimo)) {
      this.eventBus.emit(EVENTOS.STOCK_BAJO, {
        tenantId,
        productoId,
        bodegaId,
        cantidadActual: stock.cantidadActual.toString(),
        stockMinimo: stock.stockMinimo.toString(),
      });
    }
  }

  /**
   * Variante de `verificarYDescontarStock` que participa en una transacción
   * abierta por OTRO servicio (ver `FacturacionService.crear`) en vez de
   * abrir la suya propia — así el descuento de stock, el consumo de NCF y
   * la creación de la factura son todo-o-nada: si cualquiera de los tres
   * falla, los otros se revierten en vez de dejar stock descontado sin una
   * factura real que lo justifique.
   */
  async verificarYDescontarStockEnTx(
    tx: Prisma.TransactionClient,
    params: { tenantId: string; productoId: string; varianteId?: string; bodegaId: string; cantidad: number; userId: string; referencia: string },
  ) {
    await this.validarPertenencia({ productoId: params.productoId, bodegaId: params.bodegaId }, tx);
    const varianteId = await this.variantesService.resolverObligatoria(params.productoId, params.varianteId);

    const stock = await this.inventarioRepository.descontarStockCondicionalEnTx(tx, {
      tenantId: params.tenantId,
      productoId: params.productoId,
      varianteId,
      bodegaId: params.bodegaId,
      cantidad: params.cantidad,
      tipo: 'SALIDA',
      userId: params.userId,
      motivo: params.referencia,
    });

    if (!stock) {
      await this.lanzarStockInsuficiente(params.productoId, varianteId, params.bodegaId);
    }

    // `lanzarStockInsuficiente` siempre lanza — si llegamos acá, `stock` no es null (TS no infiere
    // la ausencia de retorno a través de un `await` a una función `never`, por eso el `!`).
    this.emitirSiStockBajo(params.tenantId, params.productoId, params.bodegaId, stock!);

    return stock;
  }

  /** Ver el comentario de `verificarYDescontarStockEnTx` — misma razón, para el caso de entrada (nota de crédito, anulación). */
  async entradaStockEnTx(
    tx: Prisma.TransactionClient,
    params: { tenantId: string; productoId: string; varianteId?: string; bodegaId: string; cantidad: number; userId: string; motivo: string },
  ) {
    await this.validarPertenencia({ productoId: params.productoId, bodegaId: params.bodegaId }, tx);
    const varianteId = await this.variantesService.resolverObligatoria(params.productoId, params.varianteId);
    return this.inventarioRepository.ajustarCantidadEnTx(tx, {
      tenantId: params.tenantId,
      productoId: params.productoId,
      varianteId,
      bodegaId: params.bodegaId,
      delta: params.cantidad,
      tipo: 'ENTRADA',
      userId: params.userId,
      motivo: params.motivo,
    });
  }

  async entradaStock(params: {
    tenantId: string;
    productoId: string;
    varianteId?: string;
    bodegaId: string;
    cantidad: number;
    userId: string;
    motivo: string;
  }) {
    await this.validarPertenencia({ productoId: params.productoId, bodegaId: params.bodegaId });
    const varianteId = await this.variantesService.resolverObligatoria(params.productoId, params.varianteId);
    return this.inventarioRepository.ajustarCantidad({
      tenantId: params.tenantId,
      productoId: params.productoId,
      varianteId,
      bodegaId: params.bodegaId,
      delta: params.cantidad,
      tipo: 'ENTRADA',
      userId: params.userId,
      motivo: params.motivo,
    });
  }

  async ajustarStock(params: {
    tenantId: string;
    productoId: string;
    varianteId?: string;
    bodegaId: string;
    cantidad: number;
    userId: string;
    motivo: string;
  }) {
    await this.validarPertenencia({ productoId: params.productoId, bodegaId: params.bodegaId });
    const varianteId = await this.variantesService.resolverObligatoria(params.productoId, params.varianteId);
    return this.inventarioRepository.ajustarCantidad({
      tenantId: params.tenantId,
      productoId: params.productoId,
      varianteId,
      bodegaId: params.bodegaId,
      delta: params.cantidad,
      tipo: 'AJUSTE',
      userId: params.userId,
      motivo: params.motivo,
    });
  }

  async transferirStock(params: {
    tenantId: string;
    productoId: string;
    varianteId?: string;
    bodegaOrigenId: string;
    bodegaDestinoId: string;
    cantidad: number;
    userId: string;
  }) {
    await Promise.all([
      this.validarPertenencia({ productoId: params.productoId, bodegaId: params.bodegaOrigenId }),
      this.validarPertenencia({ bodegaId: params.bodegaDestinoId }),
    ]);
    const varianteId = await this.variantesService.resolverObligatoria(params.productoId, params.varianteId);
    return this.inventarioRepository.transferir({ ...params, varianteId });
  }

  /**
   * Historial cronológico de una variante en una bodega, con saldo
   * corriente — molde calcado de `EstadosFinancierosService.libroMayor()`
   * (Fase 5a): sin paginar (ningún reporte de este proyecto pagina), las
   * filas anteriores a `desde` se acumulan en `saldoInicial` sin listarse.
   * `direccion` (no `tipo`) decide el signo — ver comentario en
   * `InventarioRepository.ajustarCantidadEnTx` sobre por qué `tipo` solo
   * no alcanza (TRANSFERENCIA/AJUSTE no tienen signo fijo).
   */
  async kardex(varianteId: string, bodegaId: string, desde?: string, hasta?: string) {
    await this.validarPertenencia({ bodegaId });
    const variante = await this.inventarioRepository.obtenerVarianteConProducto(varianteId);

    const hastaFecha = hasta ? new Date(hasta) : new Date();
    const desdeFecha = desde ? new Date(desde) : new Date(hastaFecha.getFullYear(), hastaFecha.getMonth(), 1);

    const movimientos = await this.inventarioRepository.movimientosPorVarianteBodega(varianteId, bodegaId, hastaFecha);

    let saldoInicial = 0;
    const filas: {
      id: string;
      fecha: Date;
      tipo: string;
      direccion: string;
      cantidad: number;
      motivo: string | null;
      usuario: string;
      saldoAcumulado: number;
    }[] = [];
    let saldoAcumulado = 0;

    for (const m of movimientos) {
      const delta = m.direccion === 'ENTRADA' ? Number(m.cantidad) : -Number(m.cantidad);
      if (m.createdAt < desdeFecha) {
        saldoInicial += delta;
        continue;
      }
      saldoAcumulado = (filas.length === 0 ? saldoInicial : saldoAcumulado) + delta;
      filas.push({
        id: m.id,
        fecha: m.createdAt,
        tipo: m.tipo,
        direccion: m.direccion,
        cantidad: Number(m.cantidad),
        motivo: m.motivo,
        usuario: m.user.nombre,
        saldoAcumulado,
      });
    }

    return {
      variante: { id: variante.id, sku: variante.sku, producto: { id: variante.producto.id, codigo: variante.producto.codigo, nombre: variante.producto.nombre } },
      bodegaId,
      rango: { desde: desdeFecha, hasta: hastaFecha },
      saldoInicial,
      movimientos: filas,
      saldoFinal: filas.length > 0 ? filas[filas.length - 1].saldoAcumulado : saldoInicial,
    };
  }

  async listarStockPorBodega(bodegaId: string, query: ListadoQueryDto) {
    await this.validarPertenencia({ bodegaId });
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.inventarioRepository.listarStockPorBodega(bodegaId, { skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  listarBodegas() {
    return this.inventarioRepository.listarBodegas();
  }

  crearBodega(tenantId: string, nombre: string, direccion?: string) {
    return this.inventarioRepository.crearBodega(tenantId, nombre, direccion);
  }

  actualizarBodega(id: string, data: { formatoImpresion?: FormatoImpresion | null }) {
    return this.inventarioRepository.actualizarBodega(id, data);
  }
}
