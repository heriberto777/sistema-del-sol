import { Injectable } from '@nestjs/common';
import { EstadoCxC, Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * CxC como ledger real (Fase 1) — filtra `CuentaPorCobrar` directo en vez de
 * recalcular sobre Factura+Pago (ver el modelo en schema.prisma). `saldo`/
 * `estado` los mantiene `PagosRepository.registrarCobroFactura` (Fase 3),
 * en la misma transacción que crea cada `AplicacionCobro`.
 */
const WHERE_PENDIENTE = { estado: { in: [EstadoCxC.ABIERTA, EstadoCxC.PARCIAL] } };

const INCLUDE_PARA_LISTADO = {
  cliente: { select: { nombre: true } },
  factura: { select: { numero: true, ncf: true } },
} satisfies Prisma.CuentaPorCobrarInclude;

@Injectable()
export class CuentasPorCobrarRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listar(params: { skip?: number; take?: number; busqueda?: string }) {
    const where: Prisma.CuentaPorCobrarWhereInput = {
      ...WHERE_PENDIENTE,
      ...(params.busqueda
        ? {
            OR: [
              { factura: { numero: { contains: params.busqueda, mode: 'insensitive' as const } } },
              { cliente: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.db.cuentaPorCobrar.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { fechaVencimiento: 'asc' },
        include: INCLUDE_PARA_LISTADO,
      }),
      this.db.cuentaPorCobrar.count({ where }),
    ]);
  }

  /** Sin paginar — usado por el resumen/aging, mismo criterio que antes (agrega en JS sobre un dataset acotado por tenant). */
  listarTodasPendientes() {
    return this.db.cuentaPorCobrar.findMany({
      where: WHERE_PENDIENTE,
      select: { id: true, saldo: true, fechaVencimiento: true },
    });
  }

  /** Para el bloqueo síncrono de crédito (ver FacturacionService.crear) — todo lo abierto de un cliente puntual. */
  listarAbiertasDeCliente(clienteId: string) {
    return this.db.cuentaPorCobrar.findMany({
      where: { ...WHERE_PENDIENTE, clienteId },
      select: { saldo: true, fechaVencimiento: true },
    });
  }

  crearEnTx(
    tx: Prisma.TransactionClient,
    data: {
      tenantId: string;
      clienteId: string;
      facturaId: string;
      concepto: string;
      moneda: string;
      tasaCambio?: number;
      monto: number;
      montoMoneda?: number;
      fecha: Date;
      fechaVencimiento: Date;
    },
  ) {
    return tx.cuentaPorCobrar.create({
      data: { ...data, saldo: data.monto },
    });
  }

  /** Anular una Factura CREDITO cierra su CuentaPorCobrar — no-op (0 filas) si no tenía una (CONTADO nunca la tiene). */
  anularPorFacturaEnTx(tx: Prisma.TransactionClient, facturaId: string) {
    return tx.cuentaPorCobrar.updateMany({ where: { facturaId }, data: { estado: 'ANULADA' } });
  }
}
