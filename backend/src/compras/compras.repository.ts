import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EstadoOrdenCompra, Prisma } from '@prisma/client';

@Injectable()
export class ComprasRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crearOrden(params: {
    tenantId: string;
    proveedorId: string;
    numero: string;
    userId: string;
    total: number;
    lineas: { productoId: string; varianteId: string; cantidad: number; costoUnitario: number }[];
  }) {
    return this.db.ordenCompra.create({
      data: {
        tenantId: params.tenantId,
        proveedorId: params.proveedorId,
        numero: params.numero,
        userId: params.userId,
        total: params.total,
        lineas: { create: params.lineas },
      },
      include: { lineas: true },
    });
  }

  buscarPorId(id: string) {
    return this.db.ordenCompra.findUniqueOrThrow({
      where: { id },
      // producto: para que ComprasService.recibir() sepa si una línea es
      // SERVICIO (no mueve stock al recibirse).
      include: { lineas: { include: { producto: true } }, recepciones: true, devoluciones: { include: { lineas: true } } },
    });
  }

  /** Ver `ComprasService.recibir`/`devolver` — lee dentro de la misma transacción que las escrituras, para decidir el nuevo estado sobre datos ya actualizados en esa transacción. */
  buscarPorIdEnTx(tx: Prisma.TransactionClient, id: string) {
    return tx.ordenCompra.findUniqueOrThrow({ where: { id }, include: { lineas: true, recepciones: true } });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = params.busqueda
      ? {
          OR: [
            { numero: { contains: params.busqueda, mode: 'insensitive' as const } },
            { proveedor: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
          ],
        }
      : {};
    return Promise.all([
      this.db.ordenCompra.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { proveedor: true },
        skip: params.skip,
        take: params.take,
      }),
      this.db.ordenCompra.count({ where }),
    ]);
  }

  /**
   * `actualizarEstado`/`actualizarCantidadRecibida`/`crearRecepcion`
   * reciben `tx` explícito (no un getter `this.db` con fallback) porque
   * las tres SOLO se usan dentro de `ComprasService.recibir`, que las
   * corre todas en una única transacción — antes cada una confirmaba por
   * su cuenta, así que un fallo a mitad de la recepción (p. ej. la línea 2
   * de 3 sin stock suficiente) dejaba la recepción y las cantidades
   * recibidas de las líneas anteriores YA guardadas, pero el estado de la
   * orden sin actualizar y el resto de las líneas sin procesar.
   */
  actualizarEstado(tx: Prisma.TransactionClient, id: string, estado: EstadoOrdenCompra) {
    return tx.ordenCompra.update({ where: { id }, data: { estado } });
  }

  actualizarCantidadRecibida(tx: Prisma.TransactionClient, lineaOcId: string, cantidadRecibida: number) {
    return tx.lineaOc.update({ where: { id: lineaOcId }, data: { cantidadRecibida: { increment: cantidadRecibida } } });
  }

  crearDevolucionEnTx(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      ordenCompraId: string;
      bodegaId: string;
      motivo?: string;
      lineas: { productoId: string; varianteId: string; cantidad: number; costoUnitario: number }[];
    },
  ) {
    return tx.devolucionCompra.create({
      data: {
        tenantId: params.tenantId,
        ordenCompraId: params.ordenCompraId,
        bodegaId: params.bodegaId,
        motivo: params.motivo,
        lineas: {
          create: params.lineas.map((l) => ({
            productoId: l.productoId,
            varianteId: l.varianteId,
            cantidad: l.cantidad,
            costoUnitario: l.costoUnitario,
          })),
        },
      },
      include: { lineas: true },
    });
  }

  crearRecepcion(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      ordenCompraId: string;
      facturaProveedorNumero?: string;
      montoFacturaProveedor?: number;
      // El caller (ComprasService.recibir) recibe cada línea con
      // numeroLote?/fechaVencimiento? también (Fase 5b) — son datos para
      // InventarioService.entradaStockEnTx, no columnas de LineaRecepcion,
      // así que se pickean explícito acá (Prisma rechaza en runtime
      // cualquier propiedad extra en `create`, no solo TS).
      lineas: { productoId: string; varianteId: string; cantidadRecibida: number; costoUnitario: number }[];
    },
  ) {
    return tx.recepcionCompra.create({
      data: {
        tenantId: params.tenantId,
        ordenCompraId: params.ordenCompraId,
        facturaProveedorNumero: params.facturaProveedorNumero,
        montoFacturaProveedor: params.montoFacturaProveedor,
        lineas: {
          create: params.lineas.map((l) => ({
            productoId: l.productoId,
            varianteId: l.varianteId,
            cantidadRecibida: l.cantidadRecibida,
            costoUnitario: l.costoUnitario,
          })),
        },
      },
      include: { lineas: true },
    });
  }
}
