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

  /** Dashboard "Resumen ejecutivo" — pedidos cuya factura está emitida pero no pagada todavía. Mismo join manual que `facturasPorIds`. */
  async contarPendientes() {
    const pedidos = await this.db.pedidoTienda.findMany({ select: { facturaId: true } });
    if (pedidos.length === 0) return 0;
    return this.db.factura.count({
      where: { id: { in: pedidos.map((p) => p.facturaId) }, estado: 'EMITIDA', pagada: false },
    });
  }

  /** Auditoría UX Fase 8 — reporte propio del dominio (antes `reportes: []` en menu-erp.ts). Mismo join manual que contarPendientes/facturasPorIds — PedidoTienda no tiene campos económicos propios. */
  async resumen() {
    const pedidos = await this.db.pedidoTienda.findMany({ select: { facturaId: true, createdAt: true } });
    if (pedidos.length === 0) {
      return { totalPedidos: 0, pedidosMes: 0, pendientesDePago: 0, ventasMes: 0, porEstado: {} as Record<string, number> };
    }
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const pedidosMes = pedidos.filter((p) => p.createdAt >= inicioMes).length;
    const facturas = await this.db.factura.findMany({
      where: { id: { in: pedidos.map((p) => p.facturaId) } },
      select: { estado: true, pagada: true, total: true, fecha: true },
    });
    const porEstado: Record<string, number> = {};
    let pendientesDePago = 0;
    let ventasMes = 0;
    for (const f of facturas) {
      // Mismo criterio de etiqueta que FacturasProveedor: EMITIDA se desglosa en Pagada/Pendiente, el resto queda tal cual.
      const clave = f.estado === 'EMITIDA' ? (f.pagada ? 'PAGADA' : 'PENDIENTE') : f.estado;
      porEstado[clave] = (porEstado[clave] ?? 0) + 1;
      if (f.estado === 'EMITIDA' && !f.pagada) pendientesDePago++;
      if (f.estado === 'EMITIDA' && f.fecha >= inicioMes) ventasMes += Number(f.total);
    }
    return { totalPedidos: pedidos.length, pedidosMes, pendientesDePago, ventasMes, porEstado };
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
