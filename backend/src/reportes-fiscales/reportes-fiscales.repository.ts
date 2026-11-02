import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { CLIENTE_SELECT_BASICO } from '../common/prisma/cliente-select-basico';

function finDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

@Injectable()
export class ReportesFiscalesRepository {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  // `ncf: { not: null }` — una factura de un tenant sin comprobante fiscal
  // (ver Tenant.requiereComprobanteFiscal/NcfPanel) no es un documento
  // fiscal real; nunca debe terminar en un archivo que se manda a la DGII.
  ventasEnRango(desde: Date, hasta: Date) {
    return this.db.factura.findMany({
      where: { estado: 'EMITIDA', fecha: { gte: desde, lte: finDelDia(hasta) }, ncf: { not: null } },
      orderBy: { fecha: 'asc' },
      include: { cliente: { select: CLIENTE_SELECT_BASICO } },
    });
  }

  anuladasEnRango(desde: Date, hasta: Date) {
    return this.db.factura.findMany({
      where: { estado: 'ANULADA', fecha: { gte: desde, lte: finDelDia(hasta) }, ncf: { not: null } },
      orderBy: { fecha: 'asc' },
    });
  }

  comprasRecibidasEnRango(desde: Date, hasta: Date) {
    return this.db.recepcionCompra.findMany({
      where: { fecha: { gte: desde, lte: finDelDia(hasta) } },
      orderBy: { fecha: 'asc' },
      include: {
        ordenCompra: { include: { proveedor: true } },
        lineas: { include: { producto: true } },
      },
    });
  }

  /** Comprobantes de compra al mercado informal (NCF B11/E43) — también van al 606, sin RNC de proveedor. */
  gastosMenoresEnRango(desde: Date, hasta: Date) {
    return this.db.gastoMenor.findMany({
      where: { fecha: { gte: desde, lte: finDelDia(hasta) } },
      orderBy: { fecha: 'asc' },
      include: { lineas: true },
    });
  }

  /** Facturas de proveedor sin orden de compra (Fase 5) — también van al 606, con RNC real del proveedor. Excluye ANULADA; incluye NOTA_CREDITO (el service le resta signo). */
  facturasProveedorEnRango(desde: Date, hasta: Date) {
    return this.db.facturaProveedor.findMany({
      where: { fecha: { gte: desde, lte: finDelDia(hasta) }, estado: { not: 'ANULADA' } },
      orderBy: { fecha: 'asc' },
      include: { proveedor: { select: { rnc: true } } },
    });
  }

  /** Pagos a proveedores con retención de ISR y/o ITBIS practicada — Fase 3: `OrdenPago` reemplaza `Pago.ordenCompraId`, la retención sigue viviendo en la cabecera, no por línea de aplicación. */
  retencionesProveedoresEnRango(desde: Date, hasta: Date) {
    return this.db.ordenPago.findMany({
      where: {
        fecha: { gte: desde, lte: finDelDia(hasta) },
        OR: [{ retencionIsr: { gt: 0 } }, { retencionItbis: { gt: 0 } }],
      },
      include: { proveedor: true },
      orderBy: { fecha: 'asc' },
    });
  }

  /**
   * ReciboNomina no tiene columna tenantId propia (ver tenant-scoped-models.ts)
   * y acá no llegamos a través del id de un período ya validado — por eso se
   * usa el cliente global y se filtra el tenant a mano vía la relación
   * `periodo`, en vez de `this.db` (que no inyectaría nada para este modelo).
   */
  retencionesNominaEnRango(tenantId: string, desde: Date, hasta: Date) {
    return this.prisma.reciboNomina.findMany({
      where: { periodo: { tenantId, fechaFin: { gte: desde, lte: finDelDia(hasta) } } },
      include: { empleado: true, periodo: true },
      orderBy: { periodo: { fechaFin: 'asc' } },
    });
  }
}
