import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EcommerceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Sin tenant-scoping (no hay JWT en rutas públicas) — filtra a mano por subdominio, igual que AuthService.login. */
  buscarTenantPorSubdominio(subdominio: string) {
    return this.prisma.tenant.findUnique({ where: { subdominio } });
  }

  /** El "Admin Total" más antiguo del tenant, atribuido como vendedor del pedido — mismo criterio que FacturasPlataformaService.notificarPorRegla para acciones sin un usuario real detrás. */
  buscarAdminMasAntiguo(tenantId: string) {
    return this.prisma.user.findFirst({
      where: { tenantId, roles: { some: { role: { nombre: 'Admin Total' } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * `PrismaService` global con `tenantId` explícito, mismo criterio que
   * `SesionesCobroRepository.crear` — este repositorio ya opera fuera de
   * request-scoping (rutas públicas), y `crearPedido` en el servicio se
   * llama DESPUÉS de que `FacturacionService.crear()` ya confirmó la
   * Factura, así que esta fila nunca precede a la venta real.
   */
  crearPedido(data: {
    tenantId: string;
    facturaId: string;
    clienteNombre: string;
    clienteTelefono: string;
    clienteEmail?: string;
    direccionEntrega: string;
    notas?: string;
  }) {
    return this.prisma.pedidoTienda.create({ data });
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
   * `tieneVariantes` (Fase 4) es liviano (`_count`, no trae las filas)
   * — el frontend lo usa para decidir si el "+" de la grilla agrega
   * directo o manda al detalle a elegir talla/color.
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
      _count: { select: { variantes: true } },
      variantes: {
        take: 1,
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          precios: { where: { listaPrecio: 'GENERAL', vigenteHasta: null }, select: { precioVenta: true }, take: 1 },
          stock: params.bodegaId ? { where: { bodegaId: params.bodegaId }, select: { cantidadActual: true } } : false,
        },
      },
    } as const;
    const [filas, total] = await Promise.all([
      this.prisma.producto.findMany({ where, orderBy: { nombre: 'asc' }, skip: params.skip, take: params.take, select }),
      this.prisma.producto.count({ where }),
    ]);
    const datos = filas.map(({ variantes, _count, ...producto }) => ({
      ...producto,
      // Solo tiene sentido usarlo para agregar directo cuando NO tieneVariantes (una sola variante real) — con >1, el frontend manda al detalle a elegir en vez de usar este id.
      varianteId: variantes[0]?.id ?? null,
      precio: variantes[0]?.precios[0]?.precioVenta ?? null,
      stock: params.bodegaId ? Number(variantes[0]?.stock?.[0]?.cantidadActual ?? 0) : null,
      tieneVariantes: _count.variantes > 1,
    }));
    return [datos, total] as const;
  }

  /**
   * Datos de producto SOLOS (sin variantes) — las variantes con sus
   * atributos/precio/stock se resuelven aparte vía
   * `VariantesService.listarPorProducto` (Fase 4), reusado tal cual en
   * vez de reescribir esa query acá.
   */
  buscarProductoPublico(tenantId: string, productoId: string) {
    return this.prisma.producto.findFirst({
      where: { id: productoId, tenantId, activo: true, visibleEnTienda: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        imagen: true,
        imagenAjuste: true,
        porcentajeItbis: true,
        tipo: true,
        descripcionTienda: true,
        categoria: { select: { id: true, nombre: true } },
        imagenesAdicionales: { orderBy: { orden: 'asc' }, select: { imagen: true } },
      },
    });
  }

  /** Precio GENERAL vigente de cada variante — `Precio` no tiene tenantId propio (hija de VarianteProducto, ya validada contra el tenant antes de llegar acá). */
  preciosPorVariantes(varianteIds: string[]) {
    if (!varianteIds.length) return Promise.resolve([]);
    return this.prisma.precio.findMany({
      where: { varianteId: { in: varianteIds }, listaPrecio: 'GENERAL', vigenteHasta: null },
      select: { varianteId: true, precioVenta: true },
    });
  }
}
