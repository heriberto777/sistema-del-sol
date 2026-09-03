import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EcommerceRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  private whereCatalogo(tenantId: string, busqueda?: string, categoriaId?: string, destacado?: boolean) {
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
      ...(destacado ? { destacado: true } : {}),
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
  async catalogo(params: { tenantId: string; bodegaId?: string; skip: number; take: number; busqueda?: string; categoriaId?: string; destacado?: boolean }) {
    const where = this.whereCatalogo(params.tenantId, params.busqueda, params.categoriaId, params.destacado);
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

  /** "Mis pedidos" (Fase 6) — Facturas del cliente autenticado, con su PedidoTienda (dirección/notas del guest) si la tuvo. Mismo join manual que PedidosTiendaRepository.facturasPorIds — PedidoTienda.facturaId no tiene `@relation` a Factura. */
  async misPedidos(tenantId: string, clienteId: string) {
    const facturas = await this.prisma.factura.findMany({
      where: { tenantId, clienteId },
      orderBy: { fecha: 'desc' },
      select: { id: true, numero: true, ncf: true, total: true, estado: true, pagada: true, fecha: true },
    });
    const pedidos = await this.prisma.pedidoTienda.findMany({ where: { facturaId: { in: facturas.map((f) => f.id) } } });
    const pedidoPorFactura = new Map(pedidos.map((p) => [p.facturaId, p]));
    return facturas.map((factura) => ({ factura, pedido: pedidoPorFactura.get(factura.id) ?? null }));
  }

  /**
   * Detalle completo de UN pedido (Fase 10) — 404 (`null`) si la factura
   * no existe o no pertenece a este tenant+cliente, nunca confiar en el
   * `facturaId` que manda el cliente sin esta doble validación. `select`
   * acotado (sin `turnoCaja`/recargos/notas relacionadas — eso es interno
   * de POS/admin, no le sirve al comprador).
   */
  async detallePedido(tenantId: string, clienteId: string, facturaId: string) {
    const factura = await this.prisma.factura.findFirst({
      where: { id: facturaId, tenantId, clienteId },
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
    const pedido = await this.prisma.pedidoTienda.findFirst({ where: { facturaId } });
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

  /** Fase 10 — perfil del cliente de tienda (id/nombre/email/teléfono/puntos, sin passwordHash). */
  miPerfil(clienteId: string) {
    return this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, nombre: true, email: true, telefono: true, puntosLealtad: true },
    });
  }

  /** `email` ya validado por unicidad (email+password) en el servicio antes de llamar acá. */
  actualizarPerfil(clienteId: string, data: { nombre?: string; telefono?: string; email?: string }) {
    return this.prisma.cliente.update({
      where: { id: clienteId },
      data,
      select: { id: true, nombre: true, email: true, telefono: true, puntosLealtad: true },
    });
  }

  buscarClientePorEmail(tenantId: string, email: string) {
    return this.prisma.cliente.findFirst({ where: { tenantId, email, passwordHash: { not: null } } });
  }

  /** Fase 16 — carrito persistente del cliente logueado, `null` si nunca guardó ninguno (comprador nuevo o que solo compró como guest). */
  obtenerCarrito(clienteId: string) {
    return this.prisma.carritoClienteTienda.findUnique({ where: { clienteId } });
  }

  /** Upsert simple — un solo blob por cliente, se pisa entero en cada guardado (mismo criterio que `TIENDA_TEMA`: no hay consulta por campo individual que justifique un modelo de líneas). */
  guardarCarrito(clienteId: string, itemsJson: string) {
    return this.prisma.carritoClienteTienda.upsert({
      where: { clienteId },
      create: { clienteId, itemsJson },
      update: { itemsJson },
    });
  }

  misDirecciones(clienteId: string) {
    return this.prisma.direccionCliente.findMany({ where: { clienteId }, orderBy: { esPrincipal: 'desc' } });
  }

  /** Dueño de la dirección — base del chequeo IDOR antes de actualizar/borrar (ver EcommerceService). */
  buscarDireccion(id: string) {
    return this.prisma.direccionCliente.findUnique({ where: { id } });
  }

  async crearDireccion(clienteId: string, data: { direccion: string; ciudad?: string; esPrincipal?: boolean }) {
    if (data.esPrincipal) {
      return this.prisma.$transaction(async (tx) => {
        await tx.direccionCliente.updateMany({ where: { clienteId }, data: { esPrincipal: false } });
        return tx.direccionCliente.create({ data: { clienteId, ...data } });
      });
    }
    return this.prisma.direccionCliente.create({ data: { clienteId, ...data } });
  }

  async actualizarDireccion(id: string, clienteId: string, data: { direccion?: string; ciudad?: string; esPrincipal?: boolean }) {
    if (data.esPrincipal) {
      return this.prisma.$transaction(async (tx) => {
        await tx.direccionCliente.updateMany({ where: { clienteId, id: { not: id } }, data: { esPrincipal: false } });
        return tx.direccionCliente.update({ where: { id }, data });
      });
    }
    return this.prisma.direccionCliente.update({ where: { id }, data });
  }

  eliminarDireccion(id: string) {
    return this.prisma.direccionCliente.delete({ where: { id } });
  }

  /**
   * Fase 11 — todas las ofertas vigentes AHORA MISMO, para la sección
   * "Ofertas" del storefront público — variante de
   * `OfertasRepository.buscarVigentesParaLinea`/`buscarVigentesDeCarrito`
   * (backend/src/ofertas/) sin atar a un producto/categoría puntual (esas
   * dos resuelven el descuento de UNA línea al facturar; esta lista TODAS
   * las vigentes para mostrarlas). `PrismaService` global + `tenantId`
   * explícito (mismo criterio que el resto de este repositorio: rutas
   * `@Public()`, sin `TenantPrismaService` que auto-inyecta tenantId).
   */
  ofertasVigentesPublicas(tenantId: string) {
    const ahora = new Date();
    return this.prisma.oferta.findMany({
      where: { tenantId, activa: true, fechaInicio: { lte: ahora }, fechaFin: { gte: ahora } },
      orderBy: { prioridad: 'desc' },
      select: {
        id: true,
        nombre: true,
        tipoDescuento: true,
        valor: true,
        alcance: true,
        comprarCantidad: true,
        llevarCantidad: true,
        porcentajeDescuentoLlevar: true,
        fechaFin: true,
        producto: { select: { nombre: true } },
        categoria: { select: { nombre: true } },
      },
    });
  }

  /**
   * Categorías con al menos un producto visible en la tienda (Fase 12,
   * plantillas "marketplace") — no existía ningún listado público de
   * categorías todavía, solo el filtro `categoriaId` puntual de
   * `catalogo()`. `groupBy` sobre `Producto` (no `Categoria.findMany`
   * directo) para no listar categorías vacías o con solo productos
   * ocultos/inactivos.
   */
  async categoriasPublicas(tenantId: string) {
    const grupos = await this.prisma.producto.groupBy({
      by: ['categoriaId'],
      where: { tenantId, activo: true, visibleEnTienda: true, categoriaId: { not: null } },
      _count: { _all: true },
    });
    if (!grupos.length) return [];
    const categorias = await this.prisma.categoria.findMany({
      where: { id: { in: grupos.map((g) => g.categoriaId as string) } },
      select: { id: true, nombre: true },
    });
    const nombrePorId = new Map(categorias.map((c) => [c.id, c.nombre]));
    return grupos
      .map((g) => ({ id: g.categoriaId as string, nombre: nombrePorId.get(g.categoriaId as string) ?? '—', cantidad: g._count._all }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /**
   * "También te puede interesar" (Fase 11, ampliado Fase 16) — prioriza la
   * MISMA categoría, pero nunca deja la sección vacía solo porque el
   * producto no tiene categoría o su categoría no tiene más productos:
   * si faltan para completar `limit`, rellena con cualquier otro
   * producto visible del tenant (excluyendo los ya elegidos y el propio
   * producto). `categoriaId` ahora es opcional — `null` salta directo al
   * relleno. Mismo shape/criterio que `catalogo()` (variante
   * representativa + precio + stock de la bodega de la tienda).
   */
  async productosRelacionados(params: { tenantId: string; categoriaId: string | null; excluirProductoId: string; bodegaId?: string; limit: number }) {
    const baseWhere = { tenantId: params.tenantId, activo: true, visibleEnTienda: true };
    const buscar = (where: object, take: number) =>
      this.prisma.producto.findMany({
        where,
        orderBy: { nombre: 'asc' as const },
        take,
        select: {
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
        },
      });

    const excluidos = [params.excluirProductoId];
    let filas = params.categoriaId
      ? await buscar({ ...baseWhere, categoriaId: params.categoriaId, id: { notIn: excluidos } }, params.limit)
      : [];
    excluidos.push(...filas.map((f) => f.id));

    if (filas.length < params.limit) {
      const relleno = await buscar({ ...baseWhere, id: { notIn: excluidos } }, params.limit - filas.length);
      filas = [...filas, ...relleno];
    }

    return filas.map(({ variantes, _count, ...producto }) => ({
      ...producto,
      varianteId: variantes[0]?.id ?? null,
      precio: variantes[0]?.precios[0]?.precioVenta ?? null,
      stock: params.bodegaId ? Number(variantes[0]?.stock?.[0]?.cantidadActual ?? 0) : null,
      tieneVariantes: _count.variantes > 1,
    }));
  }

  /** Mismo `select`/shape que `catalogo()`/`productosRelacionados()` — reusado acá para resolver los productos elegidos a mano de una sección (Fase 17), en el orden pedido en `ids`. Un producto que dejó de estar activo/visible simplemente no aparece — ver `seccionesActivasPublicas`. */
  private async productosPorIds(tenantId: string, ids: string[], bodegaId?: string) {
    const filas = ids.length
      ? await this.prisma.producto.findMany({
          where: { id: { in: ids }, tenantId, activo: true, visibleEnTienda: true },
          select: {
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
                stock: bodegaId ? { where: { bodegaId }, select: { cantidadActual: true } } : false,
              },
            },
          },
        })
      : [];
    const datos = filas.map(({ variantes, _count, ...producto }) => ({
      ...producto,
      varianteId: variantes[0]?.id ?? null,
      precio: variantes[0]?.precios[0]?.precioVenta ?? null,
      stock: bodegaId ? Number(variantes[0]?.stock?.[0]?.cantidadActual ?? 0) : null,
      tieneVariantes: _count.variantes > 1,
    }));
    return new Map(datos.map((d) => [d.id, d]));
  }

  /**
   * Fase 17, "Secciones Dinámicas" — secciones del Home en el orden que
   * definió el admin, solo `activa: true` (el listado completo, con
   * borradores/desactivadas, es `SeccionesTiendaRepository.listar()` del
   * lado admin). `BANNER` reusa la misma tabla `productos` que
   * `PRODUCTOS` — la única diferencia es de renderizado (slideshow vs.
   * grilla), decidida en el frontend según `tipo`.
   */
  async seccionesActivasPublicas(tenantId: string, bodegaId?: string) {
    const secciones = await this.prisma.seccionTienda.findMany({
      where: { tenantId, activa: true },
      orderBy: { orden: 'asc' },
      select: {
        id: true,
        tipo: true,
        titulo: true,
        subtitulo: true,
        ctaTexto: true,
        imagen: true,
        color: true,
        categoria: { select: { id: true, nombre: true } },
        categorias: { orderBy: { orden: 'asc' }, select: { categoria: { select: { id: true, nombre: true } } } },
        productos: { orderBy: { orden: 'asc' }, select: { productoId: true } },
      },
    });
    const idsProductos = [...new Set(secciones.flatMap((s) => s.productos.map((p) => p.productoId)))];
    const productosPorId = await this.productosPorIds(tenantId, idsProductos, bodegaId);

    return secciones.map((s) => ({
      id: s.id,
      tipo: s.tipo,
      titulo: s.titulo,
      subtitulo: s.subtitulo,
      ctaTexto: s.ctaTexto,
      imagen: s.imagen,
      color: s.color,
      categoria: s.categoria,
      categorias: s.categorias.map((c) => c.categoria),
      productos: s.productos.map((p) => productosPorId.get(p.productoId)).filter((p): p is NonNullable<typeof p> => !!p),
    }));
  }
}
