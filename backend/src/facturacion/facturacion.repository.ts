import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { MetodoPago, ModalidadFacturacion, Prisma, TipoFactura, TipoNcf } from '@prisma/client';

interface LineaCalculada {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  porcentajeItbis: number;
  montoItbis: number;
  montoTotal: number;
}

@Injectable()
export class FacturacionRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** `Tenant` no es un modelo tenant-scoped (es la tabla raíz) — TenantPrismaService lo deja pasar sin inyectar tenantId, así que se filtra por `id` directo. */
  async obtenerModalidadFacturacion(tenantId: string): Promise<ModalidadFacturacion> {
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { modalidadFacturacion: true },
    });
    return tenant.modalidadFacturacion;
  }

  obtenerProductoConPrecioVigente(productoId: string) {
    return this.db.producto.findUniqueOrThrow({
      where: { id: productoId },
      include: {
        precios: {
          where: { listaPrecio: 'GENERAL', vigenteHasta: null },
          take: 1,
        },
        // Solo tiene filas si el producto es COMBO — ver
        // FacturacionService.expandirParaInventario.
        componentes: { include: { componente: true } },
      },
    });
  }

  /**
   * Toma el próximo NCF de forma atómica para el tipo dado.
   *
   * El incremento usa `{ increment: 1 }`, que Postgres ejecuta como
   * `UPDATE ... SET "secuenciaActual" = "secuenciaActual" + 1` — relativo
   * al valor de la fila EN ESE MOMENTO, bajo su lock de fila, no al valor
   * que leyó el `findFirstOrThrow` de arriba. Es lo que hace esto seguro
   * bajo concurrencia: si dos facturas piden NCF a la vez, Postgres
   * serializa los dos `UPDATE` de esa misma fila (uno espera a que el otro
   * termine su transacción) y cada uno incrementa desde el valor ya
   * actualizado por el anterior — nunca desde el mismo valor leído dos
   * veces. La versión anterior calculaba `secuenciaActual + 1` en JS a
   * partir del valor leído, así que dos transacciones concurrentes podían
   * leer el mismo valor y escribir el mismo resultado: NCF duplicado, una
   * violación real de la norma DGII de unicidad/secuencialidad.
   */
  async siguienteNcf(tipoNcf: TipoNcf): Promise<string> {
    return this.db.$transaction((tx) => this.siguienteNcfEnTx(tx, tipoNcf));
  }

  /** Cuerpo puro de `siguienteNcf` — ver `FacturacionService.crear`/`crearFacturaEnTx`: participa en la misma transacción que el descuento de stock y la creación de la factura. */
  async siguienteNcfEnTx(tx: Prisma.TransactionClient, tipoNcf: TipoNcf): Promise<string> {
    const secuencia = await tx.ncfAsignado.findFirstOrThrow({
      where: { tipoNcf, activo: true },
    });
    const actualizada = await tx.ncfAsignado.update({
      where: { id: secuencia.id },
      data: { secuenciaActual: { increment: 1 } },
    });
    if (actualizada.secuenciaActual - 1 > actualizada.secuenciaFinal) {
      throw new Error(`Secuencia de NCF ${tipoNcf} agotada`);
    }
    return `${tipoNcf}${String(actualizada.secuenciaActual - 1).padStart(8, '0')}`;
  }

  crearFactura(params: Parameters<FacturacionRepository['crearFacturaEnTx']>[1]) {
    return this.db.$transaction((tx) => this.crearFacturaEnTx(tx, params));
  }

  /**
   * `crearFactura` es un solo `create` — no necesitaba transacción propia
   * antes de esto, pero ahora participa en la transacción de
   * `FacturacionService.crear` (junto al descuento de stock y el consumo
   * de NCF) para que las tres cosas sean todo-o-nada. Un fallo en
   * cualquiera de las tres deja de dejar a las otras dos ya confirmadas
   * (stock descontado sin factura, NCF consumido sin factura, etc.).
   */
  crearFacturaEnTx(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      clienteId: string;
      vendedorId: string;
      bodegaId: string;
      tipoFactura: TipoFactura;
      ncf?: string;
      tipoNcf?: TipoNcf;
      facturaOrigenId?: string;
      // Solo lo llenan las ventas de POS — ver PosService.registrarVenta.
      metodoPago?: MetodoPago;
      turnoCajaId?: string;
      subtotal: number;
      descuento: number;
      itbis: number;
      total: number;
      lineas: LineaCalculada[];
    },
  ) {
    return tx.factura.create({
      data: {
        tenantId: params.tenantId,
        clienteId: params.clienteId,
        vendedorId: params.vendedorId,
        bodegaId: params.bodegaId,
        tipoFactura: params.tipoFactura,
        ncf: params.ncf,
        tipoNcf: params.tipoNcf,
        facturaOrigenId: params.facturaOrigenId,
        metodoPago: params.metodoPago,
        turnoCajaId: params.turnoCajaId,
        estado: 'EMITIDA',
        subtotal: params.subtotal,
        descuento: params.descuento,
        itbis: params.itbis,
        total: params.total,
        lineas: {
          create: params.lineas.map((linea) => ({
            productoId: linea.productoId,
            cantidad: linea.cantidad,
            precioUnitario: linea.precioUnitario,
            descuento: linea.descuento,
            porcentajeItbis: linea.porcentajeItbis,
            montoItbis: linea.montoItbis,
            montoTotal: linea.montoTotal,
          })),
        },
      },
      include: { lineas: true },
    });
  }

  buscarPorId(id: string) {
    return this.db.factura.findUniqueOrThrow({
      where: { id },
      include: {
        lineas: { include: { producto: { include: { componentes: { include: { componente: true } } } } } },
        cliente: true,
        // Necesario para anular(): si ya se emitieron notas de crédito
        // parciales contra esta factura, solo hay que reintegrar lo que
        // aún no se había devuelto (ver FacturacionService.anular).
        notasRelacionadas: { where: { tipoFactura: 'NOTA_CREDITO', estado: 'EMITIDA' }, include: { lineas: true } },
      },
    });
  }

  listar(params: { skip?: number; take?: number; busqueda?: string }) {
    const where = params.busqueda
      ? {
          OR: [
            { ncf: { contains: params.busqueda, mode: 'insensitive' as const } },
            { cliente: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
          ],
        }
      : {};
    return Promise.all([
      this.db.factura.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: { cliente: true },
      }),
      this.db.factura.count({ where }),
    ]);
  }

  /** Ver `crearFacturaEnTx` — participa en la misma transacción que la reintegración de stock de `FacturacionService.anular`. */
  anularEnTx(tx: Prisma.TransactionClient, id: string, motivo: string) {
    return tx.factura.update({
      where: { id },
      data: { estado: 'ANULADA', motivoAnulacion: motivo },
      include: { lineas: true },
    });
  }
}
