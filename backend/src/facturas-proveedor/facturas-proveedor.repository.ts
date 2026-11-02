import { Injectable } from '@nestjs/common';
import { Prisma, TipoFacturaProveedor, TipoNcf } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

interface LineaCalculada {
  cuentaContableId: string;
  concepto?: string;
  valor: number;
  porcentajeItbis: number;
  montoItbis: number;
  cantidad: number;
  montoTotal: number;
}

@Injectable()
export class FacturasProveedorRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  async crearEnTx(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      proveedorId: string;
      tipo: TipoFacturaProveedor;
      facturaOrigenId?: string;
      ncfProveedor: string;
      tipoNcfProveedor: TipoNcf;
      concepto?: string;
      subtotal: number;
      itbis: number;
      total: number;
      fecha: Date;
      fechaVencimiento?: Date;
      terminoPagoId?: string;
      userId: string | null;
      lineas: LineaCalculada[];
    },
  ) {
    return tx.facturaProveedor.create({
      data: {
        tenantId: params.tenantId,
        proveedorId: params.proveedorId,
        tipo: params.tipo,
        facturaOrigenId: params.facturaOrigenId,
        ncfProveedor: params.ncfProveedor,
        tipoNcfProveedor: params.tipoNcfProveedor,
        concepto: params.concepto,
        subtotal: params.subtotal,
        itbis: params.itbis,
        total: params.total,
        fecha: params.fecha,
        fechaVencimiento: params.fechaVencimiento,
        terminoPagoId: params.terminoPagoId,
        userId: params.userId,
        lineas: {
          create: params.lineas.map((linea) => ({
            cuentaContableId: linea.cuentaContableId,
            concepto: linea.concepto,
            valor: linea.valor,
            porcentajeItbis: linea.porcentajeItbis,
            montoItbis: linea.montoItbis,
            cantidad: linea.cantidad,
            montoTotal: linea.montoTotal,
          })),
        },
      },
      include: { lineas: true },
    });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where: Prisma.FacturaProveedorWhereInput = params.busqueda
      ? {
          OR: [
            { ncfProveedor: { contains: params.busqueda, mode: 'insensitive' as const } },
            { proveedor: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
          ],
        }
      : {};
    return Promise.all([
      this.db.facturaProveedor.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { proveedor: { select: { nombre: true } }, cuentaPorPagar: { select: { saldo: true, estado: true } } },
      }),
      this.db.facturaProveedor.count({ where }),
    ]);
  }

  buscarPorId(id: string) {
    return this.db.facturaProveedor.findUniqueOrThrow({
      where: { id },
      include: {
        proveedor: true,
        lineas: { include: { cuentaContable: true } },
        cuentaPorPagar: true,
        facturaOrigen: { select: { id: true, ncfProveedor: true } },
      },
    });
  }

  /** Tenant-scoped (vía TenantPrismaService) — 404 si la factura origen es de otro tenant, mismo criterio que el resto del módulo. */
  buscarPorIdOrThrow(id: string) {
    return this.db.facturaProveedor.findUniqueOrThrow({ where: { id }, include: { cuentaPorPagar: true } });
  }

  async anularEnTx(tx: Prisma.TransactionClient, id: string) {
    return tx.facturaProveedor.update({ where: { id }, data: { estado: 'ANULADA' } });
  }
}
