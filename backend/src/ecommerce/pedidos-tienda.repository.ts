import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class PedidosTiendaRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listar(params: { skip: number; take: number }) {
    return Promise.all([
      this.db.pedidoTienda.findMany({ orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
      this.db.pedidoTienda.count(),
    ]);
  }

  /** `PedidoTienda.facturaId` no tiene `@relation` a Factura (ver comentario en schema.prisma) — join manual acá. */
  facturasPorIds(ids: string[]) {
    return this.db.factura.findMany({
      where: { id: { in: ids } },
      select: { id: true, numero: true, ncf: true, total: true, estado: true, pagada: true, fecha: true },
    });
  }

  /**
   * Detalle de UN pedido para el admin del tenant (Fase 14) — mismo shape
   * que `EcommerceRepository.detallePedido` (cliente final, Fase 10), sin
   * el filtro por `clienteId` porque acá el que consulta es el dueño del
   * tenant, no el comprador. `findUnique` (no `findUniqueOrThrow`) porque
   * un `facturaId` inexistente/de otro tenant es un 404 esperable, no un
   * error — `TenantPrismaService` ya inyecta `tenantId` en el `where`.
   */
  async detalle(facturaId: string) {
    const factura = await this.db.factura.findUnique({
      where: { id: facturaId },
      select: {
        id: true,
        numero: true,
        ncf: true,
        total: true,
        estado: true,
        pagada: true,
        fecha: true,
        lineas: {
          select: {
            cantidad: true,
            precioUnitario: true,
            montoTotal: true,
            descripcionManual: true,
            producto: { select: { nombre: true } },
          },
        },
      },
    });
    if (!factura) return null;
    const pedido = await this.db.pedidoTienda.findFirst({ where: { facturaId } });
    const { lineas, ...cabecera } = factura;
    return {
      factura: cabecera,
      pedido,
      lineas: lineas.map((l) => ({
        nombre: l.producto?.nombre ?? l.descripcionManual ?? '(producto eliminado)',
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        montoTotal: l.montoTotal,
      })),
    };
  }
}
