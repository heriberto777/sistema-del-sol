import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * Ítem Cobranza — Cuentas por Cobrar es exclusivamente CRÉDITO (CONTADO se
 * cobra al crear, ver FacturacionService.crear() / ítem "captura de forma
 * de pago"). `pagada: false` ya es el mismo flag confiable que usa
 * RecordatoriosService — un pago parcial no lo pone en true (ver
 * PagosService.registrarPagoFactura, EPSILON), así que sirve tal cual como
 * filtro sin tener que sumar `Pago` para decidir qué entra en la lista.
 */
const WHERE_PENDIENTE = { tipoFactura: 'CREDITO' as const, estado: 'EMITIDA' as const, pagada: false };

@Injectable()
export class CuentasPorCobrarRepository {
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
              { cliente: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.db.factura.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { fecha: 'asc' },
        include: { cliente: { select: { nombre: true } } },
      }),
      this.db.factura.count({ where }),
    ]);
  }

  /** Sin paginar — usado por el resumen/aging, mismo criterio que ReportesService (agrega en JS sobre un dataset acotado por tenant). */
  listarTodasPendientes() {
    return this.db.factura.findMany({
      where: WHERE_PENDIENTE,
      select: { id: true, total: true, fecha: true, plazoPagoDias: true },
    });
  }

  /** Pagos parciales ya registrados (post-hoc, ver PagosService) contra cada factura — para restar del total y saber el monto realmente pendiente. */
  sumaPagosPorFacturas(facturaIds: string[]) {
    if (!facturaIds.length) return Promise.resolve([]);
    return this.db.pago.groupBy({ by: ['facturaId'], where: { facturaId: { in: facturaIds } }, _sum: { monto: true } });
  }
}
