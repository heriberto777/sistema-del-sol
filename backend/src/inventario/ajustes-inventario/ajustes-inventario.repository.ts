import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { EstadoAjusteInventario, MotivoAjusteInventario, Prisma } from '@prisma/client';

interface LineaParaGuardar {
  productoId: string;
  varianteId: string;
  cantidad: number;
  motivoAjuste: MotivoAjusteInventario;
  motivo?: string;
  numeroLote?: string;
  fechaVencimiento?: Date;
  loteId?: string;
}

@Injectable()
export class AjustesInventarioRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** Participa en la transacción abierta por AjustesInventarioService.crear (consumo del correlativo + creación, todo o nada). */
  crearEnTx(
    tx: Prisma.TransactionClient,
    params: { tenantId: string; numero: string; bodegaId: string; userId: string; lineas: LineaParaGuardar[] },
  ) {
    return tx.ajusteInventario.create({
      data: {
        tenantId: params.tenantId,
        numero: params.numero,
        bodegaId: params.bodegaId,
        userId: params.userId,
        lineas: { create: params.lineas },
      },
      include: { lineas: true },
    });
  }

  buscarPorId(id: string) {
    return this.db.ajusteInventario.findUniqueOrThrow({
      where: { id },
      include: { lineas: { include: { producto: true } }, bodega: true },
    });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = params.busqueda
      ? {
          OR: [
            { numero: { contains: params.busqueda, mode: 'insensitive' as const } },
            { bodega: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
          ],
        }
      : {};
    return Promise.all([
      this.db.ajusteInventario.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { bodega: true },
        skip: params.skip,
        take: params.take,
      }),
      this.db.ajusteInventario.count({ where }),
    ]);
  }

  /** Reemplaza líneas por completo (delete+recreate) — solo se permite en BORRADOR, ver AjustesInventarioService.actualizar. */
  actualizar(id: string, params: { lineas: LineaParaGuardar[] }) {
    return this.db.$transaction(async (tx) => {
      await tx.lineaAjusteInventario.deleteMany({ where: { ajusteId: id } });
      return tx.ajusteInventario.update({
        where: { id },
        data: { lineas: { create: params.lineas } },
        include: { lineas: true },
      });
    });
  }

  actualizarEstado(tx: Prisma.TransactionClient, id: string, estado: EstadoAjusteInventario) {
    return tx.ajusteInventario.update({ where: { id }, data: { estado } });
  }
}
