import { BadRequestException, Injectable } from '@nestjs/common';
import { ComprasRepository } from './compras.repository';
import { InventarioService } from '../inventario/inventario.service';
import { VariantesService } from '../variantes/variantes.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearOrdenCompraDto } from './dto/crear-orden-compra.dto';
import { RecibirOrdenCompraDto } from './dto/recibir-orden-compra.dto';
import { DevolverOrdenCompraDto } from './dto/devolver-orden-compra.dto';
import { CrearPagoOrdenCompraDto } from './dto/crear-pago-orden-compra.dto';
import { PagosService } from '../pagos/pagos.service';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class ComprasService {
  constructor(
    private readonly comprasRepository: ComprasRepository,
    private readonly inventarioService: InventarioService,
    private readonly variantesService: VariantesService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly eventBus: EventBusService,
    private readonly pagosService: PagosService,
  ) {}

  async crear(dto: CrearOrdenCompraDto, userId: string, tenantId: string) {
    // Un combo es un bundle armado para el cliente al vender, no algo que
    // se le compre a un proveedor — lo que se compra son sus componentes.
    const productos = await this.tenantPrisma.client.producto.findMany({
      where: { id: { in: dto.lineas.map((l) => l.productoId) } },
    });
    const combo = productos.find((p) => p.tipo === 'COMBO');
    if (combo) {
      throw new BadRequestException(`"${combo.nombre}" es un combo — no se puede comprar directamente, comprá sus componentes`);
    }

    const total = dto.lineas.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0);
    const lineas = await Promise.all(
      dto.lineas.map(async (linea) => ({
        ...linea,
        varianteId: await this.variantesService.resolverObligatoria(linea.productoId, linea.varianteId),
      })),
    );
    return this.comprasRepository.crearOrden({ ...dto, tenantId, userId, total, lineas });
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.comprasRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.comprasRepository.buscarPorId(id);
  }

  /**
   * Recibe mercancía, actualiza stock y compara contra la factura del
   * proveedor — todo en una sola transacción (ver el comentario en
   * `ComprasRepository`): antes, un fallo a mitad de la recepción (p. ej.
   * una línea sin stock suficiente en la bodega destino) dejaba la
   * recepción y las cantidades ya recibidas de líneas anteriores guardadas
   * sin actualizar el estado de la orden ni procesar el resto.
   */
  async recibir(ordenCompraId: string, dto: RecibirOrdenCompraDto, userId: string, tenantId: string) {
    const orden = await this.comprasRepository.buscarPorId(ordenCompraId);
    // La variante de cada línea es la que ya quedó fija al crear la OC —
    // no se vuelve a pedir/resolver al recibir (mismo criterio que
    // costoUnitario en devolver(): se lee de la línea original, no del DTO).
    // Si el producto no pertenece a esta orden (dato mal formado), se
    // resuelve igual que cualquier línea suelta — nunca se manda un
    // varianteId vacío/adivinado a la base.
    const lineasConVariante = await Promise.all(
      dto.lineas.map(async (linea) => {
        const lineaOc = orden.lineas.find((l) => l.productoId === linea.productoId);
        const varianteId = lineaOc?.varianteId ?? (await this.variantesService.resolverObligatoria(linea.productoId));
        return { ...linea, varianteId };
      }),
    );

    const { recepcion } = await this.tenantPrisma.client.$transaction(async (tx) => {
      const recepcion = await this.comprasRepository.crearRecepcion(tx, {
        tenantId,
        ordenCompraId,
        facturaProveedorNumero: dto.facturaProveedorNumero,
        montoFacturaProveedor: dto.montoFacturaProveedor,
        lineas: lineasConVariante,
      });

      for (const linea of lineasConVariante) {
        const lineaOc = orden.lineas.find((l) => l.productoId === linea.productoId);
        if (lineaOc) {
          await this.comprasRepository.actualizarCantidadRecibida(tx, lineaOc.id, linea.cantidadRecibida);
        }
        // Un servicio comprado (ej. una consultoría) no mueve inventario —
        // "recibirlo" solo actualiza la cantidad recibida de la línea.
        if (lineaOc?.producto.tipo !== 'SERVICIO') {
          await this.inventarioService.entradaStockEnTx(tx, {
            tenantId,
            productoId: linea.productoId,
            varianteId: linea.varianteId,
            bodegaId: dto.bodegaId,
            cantidad: linea.cantidadRecibida,
            userId,
            motivo: `Recepción de OC ${orden.numero}`,
            referenciaTipo: 'RECEPCION_COMPRA',
            referenciaId: recepcion.id,
            // Fase 5b — si el producto controla vencimiento, InventarioService
            // exige numeroLote/fechaVencimiento (400 si faltan); si no
            // controla, este arreglo se ignora sin más.
            lotes:
              linea.numeroLote && linea.fechaVencimiento
                ? [{ numeroLote: linea.numeroLote, fechaVencimiento: linea.fechaVencimiento, cantidad: linea.cantidadRecibida }]
                : undefined,
          });
        }
      }

      const ordenActualizada = await this.comprasRepository.buscarPorIdEnTx(tx, ordenCompraId);
      const totalmenteRecibida = ordenActualizada.lineas.every((l) => Number(l.cantidadRecibida) >= Number(l.cantidad));
      await this.comprasRepository.actualizarEstado(tx, ordenCompraId, totalmenteRecibida ? 'RECIBIDA_TOTAL' : 'RECIBIDA_PARCIAL');

      return { recepcion, totalmenteRecibida };
    });

    // Comparar contra `orden.total` (el total de TODA la orden) es incorrecto
    // en una recepción parcial o cuando una orden se recibe en varios envíos:
    // la factura del proveedor que llega en ESTA recepción corresponde solo a
    // lo que se recibió en ESTA recepción, no al total pedido originalmente.
    // La comparación correcta es contra el monto de las líneas de ESTA
    // recepción específica.
    const montoEstaRecepcion = dto.lineas.reduce((acc, l) => acc + l.cantidadRecibida * l.costoUnitario, 0);
    const diferenciaVsFactura =
      dto.montoFacturaProveedor !== undefined ? montoEstaRecepcion - dto.montoFacturaProveedor : null;

    this.eventBus.emit(EVENTOS.ORDEN_COMPRA_RECIBIDA, {
      tenantId,
      ordenCompraId,
      recepcionId: recepcion.id,
      proveedorId: orden.proveedorId,
      total: orden.total.toString(),
    });

    return { recepcion, diferenciaVsFactura };
  }

  /**
   * Devuelve mercancía ya recibida al proveedor: reduce `cantidadRecibida`
   * de la OC (nunca por debajo de 0, validado antes de la transacción),
   * saca el stock correspondiente, y recalcula el estado de la orden —
   * mismo patrón todo-o-nada que `recibir`.
   */
  async devolver(ordenCompraId: string, dto: DevolverOrdenCompraDto, userId: string, tenantId: string) {
    const orden = await this.comprasRepository.buscarPorId(ordenCompraId);
    const productos = await this.tenantPrisma.client.producto.findMany({
      where: { id: { in: dto.lineas.map((l) => l.productoId) } },
    });
    const itbisPorProducto = new Map(productos.map((p) => [p.id, Number(p.porcentajeItbis)]));

    const lineasConCosto = dto.lineas.map((linea) => {
      const lineaOc = orden.lineas.find((l) => l.productoId === linea.productoId);
      if (!lineaOc) {
        throw new BadRequestException(`El producto ${linea.productoId} no pertenece a esta orden de compra`);
      }
      if (linea.cantidad > Number(lineaOc.cantidadRecibida)) {
        throw new BadRequestException(`No se puede devolver más de lo recibido para el producto ${linea.productoId}`);
      }
      return {
        productoId: linea.productoId,
        varianteId: lineaOc.varianteId,
        cantidad: linea.cantidad,
        costoUnitario: Number(lineaOc.costoUnitario),
        porcentajeItbis: itbisPorProducto.get(linea.productoId) ?? 0,
        loteId: linea.loteId,
      };
    });

    const { devolucion } = await this.tenantPrisma.client.$transaction(async (tx) => {
      const devolucion = await this.comprasRepository.crearDevolucionEnTx(tx, {
        tenantId,
        ordenCompraId,
        bodegaId: dto.bodegaId,
        motivo: dto.motivo,
        lineas: lineasConCosto,
      });

      for (const linea of lineasConCosto) {
        const lineaOc = orden.lineas.find((l) => l.productoId === linea.productoId)!;
        await this.comprasRepository.actualizarCantidadRecibida(tx, lineaOc.id, -linea.cantidad);
        // Un servicio nunca entró a Stock al recibirse (ver recibir()) —
        // "devolverlo" tampoco le corresponde descontar inventario.
        if (lineaOc.producto.tipo !== 'SERVICIO') {
          await this.inventarioService.verificarYDescontarStockEnTx(tx, {
            tenantId,
            productoId: linea.productoId,
            varianteId: linea.varianteId,
            bodegaId: dto.bodegaId,
            cantidad: linea.cantidad,
            userId,
            referencia: `Devolución a proveedor de OC ${orden.numero}`,
            referenciaTipo: 'DEVOLUCION_COMPRA',
            referenciaId: devolucion.id,
            // Fase 5b — elegido a mano por quien devuelve, nunca FEFO: se
            // está devolviendo un lote físico concreto al proveedor.
            loteId: linea.loteId,
          });
        }
      }

      const ordenActualizada = await this.comprasRepository.buscarPorIdEnTx(tx, ordenCompraId);
      const totalmenteRecibida = ordenActualizada.lineas.every((l) => Number(l.cantidadRecibida) >= Number(l.cantidad));
      await this.comprasRepository.actualizarEstado(tx, ordenCompraId, totalmenteRecibida ? 'RECIBIDA_TOTAL' : 'RECIBIDA_PARCIAL');

      return { devolucion };
    });

    const monto = lineasConCosto.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0);
    const itbis = lineasConCosto.reduce((acc, l) => acc + l.cantidad * l.costoUnitario * (l.porcentajeItbis / 100), 0);

    this.eventBus.emit(EVENTOS.ORDEN_COMPRA_DEVUELTA, {
      tenantId,
      ordenCompraId,
      devolucionId: devolucion.id,
      proveedorId: orden.proveedorId,
      monto: monto.toString(),
      itbis: itbis.toString(),
    });

    return devolucion;
  }

  async registrarPago(id: string, dto: CrearPagoOrdenCompraDto, userId: string, tenantId: string) {
    const orden = await this.comprasRepository.buscarPorId(id);
    if (orden.estado === 'CANCELADA') {
      throw new BadRequestException('No se puede registrar pago de una orden cancelada');
    }
    if (orden.pagada) {
      throw new BadRequestException('Esta orden ya está pagada en su totalidad');
    }
    return this.pagosService.registrarPagoOrdenCompra(orden, dto, userId, tenantId);
  }

  listarPagos(ordenCompraId: string) {
    return this.pagosService.listarPorOrdenCompra(ordenCompraId);
  }
}
