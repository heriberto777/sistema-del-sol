import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearProductoDto } from './dto/crear-producto.dto';

@Injectable()
export class ProductosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearProductoDto, tenantId: string) {
    return this.db.producto.create({ data: { ...dto, tenantId } });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = {
      activo: true,
      ...(params.busqueda
        ? {
            OR: [
              { nombre: { contains: params.busqueda, mode: 'insensitive' as const } },
              { codigo: { contains: params.busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.db.producto.findMany({ where, orderBy: { nombre: 'asc' }, skip: params.skip, take: params.take }),
      this.db.producto.count({ where }),
    ]);
  }

  buscarPorId(id: string) {
    return this.db.producto.findUniqueOrThrow({ where: { id } });
  }

  /**
   * Variante para cuando quien llama ya está dentro de una transacción
   * abierta (ver InventarioService.validarPertenencia) — usar `tx` en vez
   * de `this.db` es necesario para que el SET LOCAL de RLS aplicado a esa
   * transacción cubra también esta consulta (si no, cae en la conexión
   * top-level, que no tiene `app.tenant_id` seteado, y RLS la bloquea).
   */
  buscarPorIdEnTx(tx: Prisma.TransactionClient, id: string) {
    return tx.producto.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearProductoDto>) {
    return this.db.producto.update({ where: { id }, data: dto });
  }
}
