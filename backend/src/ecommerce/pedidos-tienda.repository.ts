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
}
