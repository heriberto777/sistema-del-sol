import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EcommerceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Sin tenant-scoping (no hay JWT en rutas públicas) — filtra a mano por subdominio, igual que AuthService.login. */
  buscarTenantPorSubdominio(subdominio: string) {
    return this.prisma.tenant.findUnique({ where: { subdominio } });
  }

  private whereCatalogo(tenantId: string, busqueda?: string, categoriaId?: string) {
    return {
      tenantId,
      activo: true,
      visibleEnTienda: true,
      ...(busqueda
        ? {
            OR: [
              { nombre: { contains: busqueda, mode: 'insensitive' as const } },
              { codigo: { contains: busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(categoriaId ? { categoriaId } : {}),
    };
  }

  /**
   * Catálogo público de la tienda — mismo criterio de "variante
   * representativa" que `ProductosRepository.catalogo()` (POS), más el
   * stock de esa variante en la bodega configurada de la tienda
   * (`bodegaId`, puede venir `undefined` si el tenant no configuró
   * ninguna — en ese caso no se filtra por stock, queda en null).
   */
  async catalogo(params: { tenantId: string; bodegaId?: string; skip: number; take: number; busqueda?: string; categoriaId?: string }) {
    const where = this.whereCatalogo(params.tenantId, params.busqueda, params.categoriaId);
    const select = {
      id: true,
      codigo: true,
      nombre: true,
      imagen: true,
      imagenAjuste: true,
      porcentajeItbis: true,
      tipo: true,
      categoria: { select: { id: true, nombre: true } },
      variantes: {
        take: 1,
        orderBy: { createdAt: 'asc' as const },
        select: {
          precios: { where: { listaPrecio: 'GENERAL', vigenteHasta: null }, select: { precioVenta: true }, take: 1 },
          stock: params.bodegaId ? { where: { bodegaId: params.bodegaId }, select: { cantidadActual: true } } : false,
        },
      },
    } as const;
    const [filas, total] = await Promise.all([
      this.prisma.producto.findMany({ where, orderBy: { nombre: 'asc' }, skip: params.skip, take: params.take, select }),
      this.prisma.producto.count({ where }),
    ]);
    const datos = filas.map(({ variantes, ...producto }) => ({
      ...producto,
      precio: variantes[0]?.precios[0]?.precioVenta ?? null,
      stock: params.bodegaId ? Number(variantes[0]?.stock?.[0]?.cantidadActual ?? 0) : null,
    }));
    return [datos, total] as const;
  }

  async buscarProductoPublico(tenantId: string, productoId: string, bodegaId?: string) {
    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, tenantId, activo: true, visibleEnTienda: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        imagen: true,
        imagenAjuste: true,
        porcentajeItbis: true,
        tipo: true,
        categoria: { select: { id: true, nombre: true } },
        variantes: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            precios: { where: { listaPrecio: 'GENERAL', vigenteHasta: null }, select: { precioVenta: true }, take: 1 },
            stock: bodegaId ? { where: { bodegaId }, select: { cantidadActual: true } } : false,
          },
        },
      },
    });
    if (!producto) return null;

    const { variantes, ...resto } = producto;
    return {
      ...resto,
      varianteId: variantes[0]?.id ?? null,
      precio: variantes[0]?.precios[0]?.precioVenta ?? null,
      stock: bodegaId ? Number(variantes[0]?.stock?.[0]?.cantidadActual ?? 0) : null,
    };
  }
}
