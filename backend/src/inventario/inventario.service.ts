import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { FormatoImpresion, MotivoAjusteInventario, Prisma } from '@prisma/client';
import { InventarioRepository, LoteEntrada } from './inventario.repository';
import { ProductosService } from '../productos/productos.service';
import { VariantesService } from '../variantes/variantes.service';
import { SucursalesRepository } from '../sucursales/sucursales.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { AuthService } from '../auth/auth.service';

// Plan de integración de brechas Cuadre, ítem E-2: etiqueta legible para
// cuando el cajero deja "motivo" (detalle libre) en blanco — el Kardex/
// historial nunca queda sin una descripción humana del ajuste.
const ETIQUETA_MOTIVO_AJUSTE: Record<MotivoAjusteInventario, string> = {
  MERMA: 'Merma',
  ROBO_PERDIDA: 'Robo o pérdida',
  DANO: 'Daño',
  VENCIMIENTO: 'Vencimiento',
  CORRECCION_CONTEO: 'Corrección de conteo',
  OTRO: 'Otro',
};

@Injectable()
export class InventarioService {
  constructor(
    private readonly inventarioRepository: InventarioRepository,
    private readonly productosService: ProductosService,
    private readonly variantesService: VariantesService,
    private readonly sucursalesRepository: SucursalesRepository,
    private readonly eventBus: EventBusService,
    private readonly authService: AuthService,
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
  private async validarPertenencia(
    params: { productoId?: string; bodegaId?: string; userId?: string },
    tx?: Prisma.TransactionClient,
  ) {
    const [producto, bodega] = await Promise.all([
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
    if (bodega && params.userId) {
      await this.validarAccesoSucursal(params.userId, bodega.sucursalId, tx);
    }
    return { producto, bodega };
  }

  /**
   * Fase 9 — enforcement real de "permisos por sucursal" (Fase 8 solo
   * filtraba la UX). Solo se llama con `userId` desde las operaciones
   * transaccionales de escritura (descuento/entrada/ajuste/transferencia de
   * stock) — las de solo lectura (`kardex`, `listarLotes`, etc.) siguen
   * llamando a `validarPertenencia` sin `userId`, así que no quedan
   * restringidas (decisión explícita: el enforcement duro es solo para
   * escritura, lectura se queda como filtro UX de Fase 8).
   */
  private async validarAccesoSucursal(userId: string, sucursalId: string, tx?: Prisma.TransactionClient) {
    const permitido = tx
      ? await this.sucursalesRepository.usuarioPuedeOperarEnTx(tx, userId, sucursalId)
      : await this.sucursalesRepository.usuarioPuedeOperar(userId, sucursalId);
    if (!permitido) {
      throw new ForbiddenException('No tenés acceso a la sucursal de esta bodega');
    }
  }

  /** Para servicios que no mueven stock pero sí necesitan validar bodega+acceso antes de operar (ver PosService.abrirTurno). */
  async validarAccesoBodega(bodegaId: string, userId: string) {
    const bodega = await this.inventarioRepository.buscarBodegaPorId(bodegaId);
    await this.validarAccesoSucursal(userId, bodega.sucursalId);
    return bodega;
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
    /** Solo si el producto controla vencimiento — devolución a proveedor (elige explícito, no FEFO); si se omite, FEFO automático. */
    loteId?: string;
  }) {
    const { producto } = await this.validarPertenencia({ productoId: params.productoId, bodegaId: params.bodegaId, userId: params.userId });
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
      controlaVencimiento: producto!.controlaVencimiento,
      loteId: params.loteId,
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
    params: {
      tenantId: string;
      productoId: string;
      varianteId?: string;
      bodegaId: string;
      cantidad: number;
      userId: string;
      referencia: string;
      referenciaTipo?: string;
      referenciaId?: string;
      loteId?: string;
    },
  ) {
    const { producto } = await this.validarPertenencia(
      { productoId: params.productoId, bodegaId: params.bodegaId, userId: params.userId },
      tx,
    );
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
      referenciaTipo: params.referenciaTipo,
      referenciaId: params.referenciaId,
      controlaVencimiento: producto!.controlaVencimiento,
      loteId: params.loteId,
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
    params: {
      tenantId: string;
      productoId: string;
      varianteId?: string;
      bodegaId: string;
      cantidad: number;
      userId: string;
      motivo: string;
      referenciaTipo?: string;
      referenciaId?: string;
      /** Obligatorio si el producto controla vencimiento (salvo Nota de Crédito, que los reconstruye sola — ver FacturacionService.crear). */
      lotes?: LoteEntrada[];
    },
  ) {
    const { producto } = await this.validarPertenencia(
      { productoId: params.productoId, bodegaId: params.bodegaId, userId: params.userId },
      tx,
    );
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
      referenciaTipo: params.referenciaTipo,
      referenciaId: params.referenciaId,
      controlaVencimiento: producto!.controlaVencimiento,
      lotesEntrada: params.lotes,
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
    lotes?: LoteEntrada[];
  }) {
    const { producto } = await this.validarPertenencia({ productoId: params.productoId, bodegaId: params.bodegaId, userId: params.userId });
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
      controlaVencimiento: producto!.controlaVencimiento,
      lotesEntrada: params.lotes,
    });
  }

  async ajustarStock(params: {
    tenantId: string;
    productoId: string;
    varianteId?: string;
    bodegaId: string;
    cantidad: number;
    userId: string;
    motivoAjuste: MotivoAjusteInventario;
    /** Detalle libre opcional, además de la categoría estructurada — ver ETIQUETA_MOTIVO_AJUSTE. */
    motivo?: string;
    /** Solo si el producto controla vencimiento — entrada (cantidad > 0): lote a acreditar. */
    numeroLote?: string;
    fechaVencimiento?: Date;
    /** Solo si el producto controla vencimiento — salida (cantidad < 0): de qué lote sale (siempre explícito, nunca FEFO en un ajuste manual). */
    loteId?: string;
    /** Requerido solo si el usuario tiene PIN configurado (Fase 9) y la cantidad es negativa (salida/merma). */
    pin?: string;
  }) {
    const { producto } = await this.validarPertenencia({ productoId: params.productoId, bodegaId: params.bodegaId, userId: params.userId });
    // Fase 9: PIN de confirmación solo en salidas (riesgo real de encubrir
    // faltantes) — una entrada positiva (corregir un conteo de más) no lo pide.
    if (params.cantidad < 0) {
      await this.authService.verificarPin(params.userId, params.pin);
    }
    const varianteId = await this.variantesService.resolverObligatoria(params.productoId, params.varianteId);
    return this.inventarioRepository.ajustarCantidad({
      tenantId: params.tenantId,
      productoId: params.productoId,
      varianteId,
      bodegaId: params.bodegaId,
      delta: params.cantidad,
      tipo: 'AJUSTE',
      userId: params.userId,
      motivo: params.motivo?.trim() || ETIQUETA_MOTIVO_AJUSTE[params.motivoAjuste],
      motivoAjuste: params.motivoAjuste,
      controlaVencimiento: producto!.controlaVencimiento,
      lotesEntrada:
        params.cantidad >= 0 && params.numeroLote && params.fechaVencimiento
          ? [{ numeroLote: params.numeroLote, fechaVencimiento: params.fechaVencimiento, cantidad: params.cantidad }]
          : undefined,
      loteIdSalida: params.cantidad < 0 ? params.loteId : undefined,
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
    // Transferir entre sucursales sigue siendo una operación de negocio
    // válida (Fase 8c) pero quien la ejecuta necesita acceso a las DOS
    // sucursales que toca, no solo a la de origen — si no, alguien con una
    // sola sucursal asignada podría sacar/recibir stock de otra sin estar
    // autorizado ahí. Un usuario que legítimamente mueve stock entre
    // locales (ej. un gerente regional) simplemente tiene ambas asignadas.
    const [{ producto }] = await Promise.all([
      this.validarPertenencia({ productoId: params.productoId, bodegaId: params.bodegaOrigenId, userId: params.userId }),
      this.validarPertenencia({ bodegaId: params.bodegaDestinoId, userId: params.userId }),
    ]);
    const varianteId = await this.variantesService.resolverObligatoria(params.productoId, params.varianteId);
    return this.inventarioRepository.transferir({ ...params, varianteId, controlaVencimiento: producto!.controlaVencimiento });
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

  /** Lotes con saldo de una variante+bodega (Fase 5b) — para elegir "de qué lote sale" en devolución a proveedor / ajuste manual negativo. */
  async listarLotes(varianteId: string, bodegaId: string) {
    await this.validarPertenencia({ bodegaId });
    return this.inventarioRepository.listarLotesConSaldo(varianteId, bodegaId);
  }

  /** Reporte de vencimientos próximos (Fase 5b) — todas las bodegas del tenant, sin paginar (Patrón A de reportes/). */
  vencimientos(diasProximidad = 30) {
    return this.inventarioRepository.lotesPorVencer(diasProximidad);
  }

  /**
   * Ver FacturacionService.crear (NOTA_CREDITO) — reparte la cantidad
   * devuelta entre los lotes que alimentaron la venta original, sin
   * pedirle nada al usuario. Recibe el `tx` de esa misma transacción
   * (nunca abre la suya propia) — ver comentario en
   * InventarioRepository.reconstruirLotesDeVentaEnTx.
   */
  reconstruirLotesDeVentaEnTx(tx: Prisma.TransactionClient, facturaOrigenId: string, varianteId: string, cantidadADevolver: number) {
    return this.inventarioRepository.reconstruirLotesDeVentaEnTx(tx, facturaOrigenId, varianteId, cantidadADevolver);
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

  async crearBodega(tenantId: string, sucursalId: string, nombre: string, direccion?: string) {
    // Valida que la sucursal pertenezca al tenant antes de colgarle una
    // bodega — mismo patrón IDOR-safe que validarPertenencia() de arriba.
    await this.sucursalesRepository.buscarPorId(sucursalId);
    return this.inventarioRepository.crearBodega(tenantId, sucursalId, nombre, direccion);
  }

  actualizarBodega(id: string, data: { formatoImpresion?: FormatoImpresion | null }) {
    return this.inventarioRepository.actualizarBodega(id, data);
  }
}
