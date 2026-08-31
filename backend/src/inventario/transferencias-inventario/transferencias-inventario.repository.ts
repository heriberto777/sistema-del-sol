import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { EstadoTransferenciaInventario, Prisma } from '@prisma/client';

interface LineaParaGuardar {
  productoId: string;
  varianteId: string;
  cantidad: number;
}

@Injectable()
export class TransferenciasInventarioRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** Participa en la transacción abierta por TransferenciasInventarioService.crear (consumo del correlativo + creación, todo o nada). */
  crearEnTx(
    tx: Prisma.TransactionClient,
    params: { tenantId: string; numero: string; bodegaOrigenId: string; bodegaDestinoId: string; userId: string; lineas: LineaParaGuardar[] },
  ) {
    return tx.transferenciaInventario.create({
      data: {
        tenantId: params.tenantId,
        numero: params.numero,
        bodegaOrigenId: params.bodegaOrigenId,
        bodegaDestinoId: params.bodegaDestinoId,
        userId: params.userId,
        lineas: { create: params.lineas },
      },
      include: { lineas: true },
    });
  }

  buscarPorId(id: string) {
    return this.db.transferenciaInventario.findUniqueOrThrow({
      where: { id },
      include: { lineas: { include: { producto: true } }, bodegaOrigen: true, bodegaDestino: true },
    });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = params.busqueda
      ? {
          OR: [
            { numero: { contains: params.busqueda, mode: 'insensitive' as const } },
            { bodegaOrigen: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
            { bodegaDestino: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
          ],
        }
      : {};
    return Promise.all([
      this.db.transferenciaInventario.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { bodegaOrigen: true, bodegaDestino: true },
        skip: params.skip,
        take: params.take,
      }),
      this.db.transferenciaInventario.count({ where }),
    ]);
  }

  /** Reemplaza líneas por completo (delete+recreate) — solo se permite en BORRADOR, ver TransferenciasInventarioService.actualizar. */
  actualizar(id: string, params: { lineas: LineaParaGuardar[] }) {
    return this.db.$transaction(async (tx) => {
      await tx.lineaTransferenciaInventario.deleteMany({ where: { transferenciaId: id } });
      return tx.transferenciaInventario.update({
        where: { id },
        data: { lineas: { create: params.lineas } },
        include: { lineas: true },
      });
    });
  }

  actualizarEstado(tx: Prisma.TransactionClient, id: string, estado: EstadoTransferenciaInventario) {
    return tx.transferenciaInventario.update({ where: { id }, data: { estado } });
  }
}
