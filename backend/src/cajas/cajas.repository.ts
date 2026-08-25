import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearCajaDto } from './dto/crear-caja.dto';

const INCLUDE_CAJA = {
  bodega: { select: { id: true, nombre: true } },
  categorias: { select: { categoriaId: true, categoria: { select: { id: true, nombre: true } } } },
  productos: { select: { productoId: true, producto: { select: { id: true, codigo: true, nombre: true } } } },
  favoritos: { select: { productoId: true, producto: { select: { id: true, codigo: true, nombre: true } } } },
} as const;

@Injectable()
export class CajasRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearCajaDto, tenantId: string) {
    const { categoriaIds, productoIds, favoritoIds, ...datos } = dto;
    return this.db.caja.create({
      data: {
        ...datos,
        tenantId,
        categorias: categoriaIds?.length ? { create: categoriaIds.map((categoriaId) => ({ categoriaId })) } : undefined,
        productos: productoIds?.length ? { create: productoIds.map((productoId) => ({ productoId })) } : undefined,
        favoritos: favoritoIds?.length ? { create: favoritoIds.map((productoId) => ({ productoId })) } : undefined,
      },
      include: INCLUDE_CAJA,
    });
  }

  listar() {
    return this.db.caja.findMany({ orderBy: { nombre: 'asc' }, include: INCLUDE_CAJA });
  }

  buscarPorId(id: string) {
    return this.db.caja.findUniqueOrThrow({ where: { id }, include: INCLUDE_CAJA });
  }

  /** Solo lo que necesita PosService para validar una venta — sin traer nombres. */
  buscarRestriccion(id: string) {
    return this.db.caja.findUniqueOrThrow({
      where: { id },
      select: { categorias: { select: { categoriaId: true } }, productos: { select: { productoId: true } } },
    });
  }

  productosInfo(productoIds: string[]) {
    return this.db.producto.findMany({ where: { id: { in: productoIds } }, select: { id: true, nombre: true, categoriaId: true } });
  }

  /**
   * `categoriaIds`/`productoIds`/`favoritoIds` reemplazan por completo la
   * asignación existente (mismo patrón que `ProductosRepository.
   * actualizar` con `componentes` de un COMBO) — `undefined` deja la
   * lista actual tal cual, `[]` o con elementos la reemplaza.
   */
  actualizar(id: string, dto: Partial<CrearCajaDto>) {
    const { categoriaIds, productoIds, favoritoIds, ...datos } = dto;
    return this.db.$transaction(async (tx) => {
      if (categoriaIds !== undefined) {
        await tx.cajaCategoria.deleteMany({ where: { cajaId: id } });
        if (categoriaIds.length) {
          await tx.cajaCategoria.createMany({ data: categoriaIds.map((categoriaId) => ({ cajaId: id, categoriaId })) });
        }
      }
      if (productoIds !== undefined) {
        await tx.cajaProducto.deleteMany({ where: { cajaId: id } });
        if (productoIds.length) {
          await tx.cajaProducto.createMany({ data: productoIds.map((productoId) => ({ cajaId: id, productoId })) });
        }
      }
      if (favoritoIds !== undefined) {
        await tx.cajaProductoFavorito.deleteMany({ where: { cajaId: id } });
        if (favoritoIds.length) {
          await tx.cajaProductoFavorito.createMany({ data: favoritoIds.map((productoId) => ({ cajaId: id, productoId })) });
        }
      }
      return tx.caja.update({ where: { id }, data: datos, include: INCLUDE_CAJA });
    });
  }

  eliminar(id: string) {
    return this.db.caja.delete({ where: { id } });
  }
}
