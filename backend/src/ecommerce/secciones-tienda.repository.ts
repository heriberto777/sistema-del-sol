import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearSeccionTiendaDto } from './dto/crear-seccion-tienda.dto';

/** Campos propios de SeccionTienda, sin los arrays de ids que se resuelven aparte contra las tablas hijas (ver `crear`/`actualizar`). */
type CamposSeccion = Omit<CrearSeccionTiendaDto, 'productoIds' | 'categoriaIds'>;

@Injectable()
export class SeccionesTiendaRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  private include() {
    return {
      categoria: { select: { id: true, nombre: true } },
      productos: {
        orderBy: { orden: 'asc' as const },
        select: { productoId: true, producto: { select: { id: true, nombre: true, imagen: true } } },
      },
      categorias: {
        orderBy: { orden: 'asc' as const },
        select: { categoriaId: true, categoria: { select: { id: true, nombre: true } } },
      },
    };
  }

  listar() {
    return this.db.seccionTienda.findMany({ orderBy: { orden: 'asc' }, include: this.include() });
  }

  buscarPorId(id: string) {
    return this.db.seccionTienda.findUniqueOrThrow({ where: { id }, include: this.include() });
  }

  async crear(tenantId: string, dto: CrearSeccionTiendaDto) {
    const { productoIds, categoriaIds, ...campos } = dto;
    const orden = await this.db.seccionTienda.count();
    return this.db.seccionTienda.create({
      data: {
        ...(campos as CamposSeccion),
        tenantId,
        orden,
        productos: productoIds ? { create: productoIds.map((productoId, i) => ({ productoId, orden: i })) } : undefined,
        categorias: categoriaIds ? { create: categoriaIds.map((categoriaId, i) => ({ categoriaId, orden: i })) } : undefined,
      },
      include: this.include(),
    });
  }

  /**
   * `productoIds`/`categoriaIds` son reemplazo total (borrar todas +
   * recrear), nunca "mover de posición" — mismo criterio que
   * `ImagenProducto`. Se tocan solo si el PATCH los incluyó; un PATCH que
   * solo cambia `titulo`, por ejemplo, no toca los productos/categorías ya
   * asignados.
   */
  async actualizar(id: string, dto: Partial<CrearSeccionTiendaDto>) {
    const { productoIds, categoriaIds, ...campos } = dto;
    return this.db.$transaction(async (tx) => {
      if (productoIds) {
        await tx.seccionTiendaProducto.deleteMany({ where: { seccionId: id } });
      }
      if (categoriaIds) {
        await tx.seccionTiendaCategoria.deleteMany({ where: { seccionId: id } });
      }
      return tx.seccionTienda.update({
        where: { id },
        data: {
          ...(campos as Partial<CamposSeccion>),
          productos: productoIds ? { create: productoIds.map((productoId, i) => ({ productoId, orden: i })) } : undefined,
          categorias: categoriaIds ? { create: categoriaIds.map((categoriaId, i) => ({ categoriaId, orden: i })) } : undefined,
        },
        include: this.include(),
      });
    });
  }

  eliminar(id: string) {
    return this.db.seccionTienda.delete({ where: { id } });
  }

  async reordenar(ids: string[]) {
    await this.db.$transaction(async (tx) => {
      for (const [orden, id] of ids.entries()) {
        await tx.seccionTienda.update({ where: { id }, data: { orden } });
      }
    });
  }
}
