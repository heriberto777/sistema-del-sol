import { Injectable } from '@nestjs/common';
import { EstadoOrdenCompra } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * Ítem Cuentas por Pagar — órdenes de compra con un compromiso real de
 * pago pendiente. BORRADOR queda afuera (todavía no es un compromiso con
 * el proveedor) y CANCELADA también. `pagada: false` es el mismo flag
 * confiable que usa PagosService.registrarPagoOrdenCompra (un pago
 * parcial no lo pone en true), así que sirve tal cual como filtro sin
 * tener que sumar `Pago` para decidir qué entra en la lista.
 */
const WHERE_PENDIENTE = {
  estado: { in: ['ENVIADA', 'RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL'] as EstadoOrdenCompra[] },
  pagada: false,
};

@Injectable()
export class CuentasPorPagarRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listar(params: { skip?: number; take?: number; busqueda?: string }) {
    const where = {
      ...WHERE_PENDIENTE,
      ...(params.busqueda
        ? {
            OR: [
              { numero: { contains: params.busqueda, mode: 'insensitive' as const } },
              { proveedor: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.db.ordenCompra.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { fecha: 'asc' },
        include: { proveedor: { select: { nombre: true, plazoPagoDias: true } } },
      }),
      this.db.ordenCompra.count({ where }),
    ]);
  }

  /** Sin paginar — usado por el resumen/aging, mismo criterio que CuentasPorCobrarRepository.listarTodasPendientes. */
  listarTodasPendientes() {
    return this.db.ordenCompra.findMany({
      where: WHERE_PENDIENTE,
      select: { id: true, total: true, fecha: true, proveedor: { select: { plazoPagoDias: true } } },
    });
  }

  /** Pagos ya registrados contra cada orden — para restar del total y saber el monto realmente pendiente. */
  sumaPagosPorOrdenes(ordenIds: string[]) {
    if (!ordenIds.length) return Promise.resolve([]);
    return this.db.pago.groupBy({ by: ['ordenCompraId'], where: { ordenCompraId: { in: ordenIds } }, _sum: { monto: true } });
  }
}
