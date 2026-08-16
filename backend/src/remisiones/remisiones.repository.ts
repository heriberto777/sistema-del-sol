import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EstadoRemision } from '@prisma/client';

const INCLUDE_REMISION = { lineas: { include: { producto: true } }, cliente: true, bodega: true } as const;

@Injectable()
export class RemisionesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(params: {
    tenantId: string;
    clienteId: string;
    bodegaId: string;
    vendedorId: string;
    numero: string;
    lineas: { productoId: string; cantidad: number }[];
  }) {
    return this.db.remision.create({
      data: {
        tenantId: params.tenantId,
        clienteId: params.clienteId,
        bodegaId: params.bodegaId,
        vendedorId: params.vendedorId,
        numero: params.numero,
        lineas: { create: params.lineas },
      },
      include: INCLUDE_REMISION,
    });
  }

  buscarPorId(id: string) {
    return this.db.remision.findUniqueOrThrow({ where: { id }, include: INCLUDE_REMISION });
  }

  /** Reemplaza líneas por completo (delete+recreate) — solo se permite en BORRADOR, ver RemisionesService.actualizar. */
  actualizar(
    id: string,
    params: { clienteId: string; bodegaId: string; numero: string; lineas: { productoId: string; cantidad: number }[] },
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.lineaRemision.deleteMany({ where: { remisionId: id } });
      return tx.remision.update({
        where: { id },
        data: {
          clienteId: params.clienteId,
          bodegaId: params.bodegaId,
          numero: params.numero,
          lineas: { create: params.lineas },
        },
        include: INCLUDE_REMISION,
      });
    });
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
      this.db.remision.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { cliente: true },
        skip: params.skip,
        take: params.take,
      }),
      this.db.remision.count({ where }),
    ]);
  }

  actualizarEstado(id: string, estado: EstadoRemision) {
    return this.db.remision.update({ where: { id }, data: { estado }, include: INCLUDE_REMISION });
  }

  marcarFacturada(id: string, facturaId: string) {
    return this.db.remision.update({
      where: { id },
      data: { estado: 'FACTURADA', facturaId },
      include: INCLUDE_REMISION,
    });
  }
}
