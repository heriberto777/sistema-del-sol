import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EstadoCotizacion, Prisma } from '@prisma/client';

interface LineaCalculada {
  productoId: string;
  varianteId: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  porcentajeItbis: number;
  montoItbis: number;
  montoTotal: number;
}

const INCLUDE_COTIZACION = { lineas: { include: { producto: true } }, cliente: true } as const;

@Injectable()
export class CotizacionesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** Ver el comentario equivalente en FacturacionRepository — Precio cuelga de VarianteProducto desde la Fase 3c, reaplanado acá a `producto.precios`. */
  async obtenerProductoConPrecioVigente(productoId: string, varianteId: string, listaPrecio = 'GENERAL') {
    const producto = await this.db.producto.findUniqueOrThrow({
      where: { id: productoId },
      include: {
        variantes: {
          where: { id: varianteId },
          include: { precios: { where: { listaPrecio, vigenteHasta: null }, take: 1 } },
        },
      },
    });
    const { variantes, ...resto } = producto;
    return { ...resto, precios: variantes[0]?.precios ?? [] };
  }

  /** Participa en la transacción abierta por CotizacionesService.crear (consumo del correlativo + creación, todo o nada). */
  crearEnTx(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      numero: string;
      clienteId: string;
      vendedorId: string;
      fechaVigenciaHasta: Date;
      subtotal: number;
      descuento: number;
      itbis: number;
      total: number;
      lineas: LineaCalculada[];
    },
  ) {
    return tx.cotizacion.create({
      data: {
        tenantId: params.tenantId,
        numero: params.numero,
        clienteId: params.clienteId,
        vendedorId: params.vendedorId,
        fechaVigenciaHasta: params.fechaVigenciaHasta,
        subtotal: params.subtotal,
        descuento: params.descuento,
        itbis: params.itbis,
        total: params.total,
        lineas: { create: params.lineas },
      },
      include: INCLUDE_COTIZACION,
    });
  }

  /** Reemplaza líneas por completo (delete+recreate) — solo se permite en BORRADOR, ver CotizacionesService.actualizar. El número asignado al crear no se toca acá. */
  actualizar(
    id: string,
    params: {
      clienteId: string;
      fechaVigenciaHasta: Date;
      subtotal: number;
      descuento: number;
      itbis: number;
      total: number;
      lineas: LineaCalculada[];
    },
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.lineaCotizacion.deleteMany({ where: { cotizacionId: id } });
      return tx.cotizacion.update({
        where: { id },
        data: {
          clienteId: params.clienteId,
          fechaVigenciaHasta: params.fechaVigenciaHasta,
          subtotal: params.subtotal,
          descuento: params.descuento,
          itbis: params.itbis,
          total: params.total,
          lineas: { create: params.lineas },
        },
        include: INCLUDE_COTIZACION,
      });
    });
  }

  buscarPorId(id: string) {
    return this.db.cotizacion.findUniqueOrThrow({ where: { id }, include: INCLUDE_COTIZACION });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = params.busqueda
      ? {
          OR: [
            { numero: { contains: params.busqueda, mode: 'insensitive' as const } },
            { cliente: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
          ],
        }
      : {};
    return Promise.all([
      this.db.cotizacion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { cliente: true },
        skip: params.skip,
        take: params.take,
      }),
      this.db.cotizacion.count({ where }),
    ]);
  }

  actualizarEstado(id: string, estado: EstadoCotizacion) {
    return this.db.cotizacion.update({ where: { id }, data: { estado }, include: INCLUDE_COTIZACION });
  }

  marcarConvertida(id: string, facturaId: string) {
    return this.db.cotizacion.update({
      where: { id },
      data: { estado: 'ACEPTADA', facturaId },
      include: INCLUDE_COTIZACION,
    });
  }
}
