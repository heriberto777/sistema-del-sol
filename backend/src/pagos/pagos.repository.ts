import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class PagosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(params: {
    tenantId: string;
    facturaId?: string;
    ordenCompraId?: string;
    monto: number;
    retencionIsr?: number;
    retencionItbis?: number;
    formaPagoId: string;
    referencia?: string;
    fecha: Date;
    userId: string;
  }) {
    return this.db.pago.create({ data: params, include: { formaPago: { select: { nombre: true } } } });
  }

  listarPorFactura(facturaId: string) {
    return this.db.pago.findMany({
      where: { facturaId },
      orderBy: { fecha: 'desc' },
      include: { formaPago: { select: { nombre: true } } },
    });
  }

  listarPorOrdenCompra(ordenCompraId: string) {
    return this.db.pago.findMany({
      where: { ordenCompraId },
      orderBy: { fecha: 'desc' },
      include: { formaPago: { select: { nombre: true } } },
    });
  }

  async sumaPagosFactura(facturaId: string): Promise<number> {
    const { _sum } = await this.db.pago.aggregate({ where: { facturaId }, _sum: { monto: true } });
    return Number(_sum.monto ?? 0);
  }

  async sumaPagosOrdenCompra(ordenCompraId: string): Promise<number> {
    const { _sum } = await this.db.pago.aggregate({ where: { ordenCompraId }, _sum: { monto: true } });
    return Number(_sum.monto ?? 0);
  }

  marcarFacturaPagada(facturaId: string, fechaPago: Date) {
    return this.db.factura.update({ where: { id: facturaId }, data: { pagada: true, fechaPago } });
  }

  marcarOrdenCompraPagada(ordenCompraId: string, fechaPago: Date) {
    return this.db.ordenCompra.update({ where: { id: ordenCompraId }, data: { pagada: true, fechaPago } });
  }
}
