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

  /**
   * `componentes` no es una columna de Producto — se crea aparte, en la
   * misma transacción, como filas de ComponenteCombo. Todo producto tiene
   * siempre al menos una `VarianteProducto` (Fase 3c) — acá se crea la
   * "por defecto" (sin valores de atributo); `VariantesService.
   * generarCombinaciones` la reemplaza por variantes reales si el
   * producto define atributos.
   */
  crear(dto: CrearProductoDto, tenantId: string) {
    // `atributos` no es una columna de Producto — se ignora al crear (ver
    // el comentario equivalente en `actualizar()`); un producto nuevo
    // siempre arranca con su variante "por defecto" sin atributos.
    const { componentes, atributos, ...datosProducto } = dto;
    void atributos;
    return this.db.$transaction(async (tx) => {
      const producto = await tx.producto.create({ data: { ...datosProducto, tenantId } });
      await tx.varianteProducto.create({ data: { productoId: producto.id, tenantId } });
      if (componentes?.length) {
        await tx.componenteCombo.createMany({
          data: componentes.map((c) => ({ comboId: producto.id, componenteId: c.productoId, cantidad: c.cantidad })),
        });
      }
      return producto;
    });
  }

  // Matchear codigoBarras acá (no solo nombre/código) es lo que hace que
  // un lector de código de barras USB (emula teclado + Enter, sin
  // integración especial) ya funcione tal cual contra este buscador —
  // Fase 3d de adopción de Cuadre.
  private whereBusqueda(busqueda?: string, categoriaId?: string) {
    return {
      activo: true,
      ...(busqueda
        ? {
            OR: [
              { nombre: { contains: busqueda, mode: 'insensitive' as const } },
              { codigo: { contains: busqueda, mode: 'insensitive' as const } },
              { variantes: { some: { codigoBarras: { contains: busqueda, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
      ...(categoriaId ? { categoriaId } : {}),
    };
  }

  // Select explícito que EXCLUYE `imagen` a propósito — es el listado que
  // alimenta Productos.tsx y ComboboxBusqueda, no debe cargar blobs de
  // imagen en cada tecla de búsqueda. Ver `catalogo()` para el uso que sí
  // la necesita. Mismos campos que ya devolvía este endpoint antes de
  // agregar la columna `imagen`, para no romper a ningún consumidor.
  listar(params: { skip: number; take: number; busqueda?: string; categoriaId?: string }) {
    const where = this.whereBusqueda(params.busqueda, params.categoriaId);
    const select = {
      id: true,
      codigo: true,
      nombre: true,
      categoriaId: true,
      categoria: { select: { id: true, nombre: true } },
      unidadMedida: true,
      porcentajeItbis: true,
      tipo: true,
      activo: true,
      createdAt: true,
      updatedAt: true,
    } as const;
    return Promise.all([
      this.db.producto.findMany({ where, orderBy: { nombre: 'asc' }, skip: params.skip, take: params.take, select }),
      this.db.producto.count({ where }),
    ]);
  }

  /**
   * Para el catálogo de POS (Modelo C) — sí trae `imagen` y el precio
   * vigente, para pintar la grilla sin un round-trip por producto. Precio
   * ya no cuelga directo de Producto (Fase 3c — ver VarianteProducto): se
   * busca a través de la variante "por defecto" y se reaplana el
   * resultado a `precios` para que `ProductosService.catalogo()` no tenga
   * que cambiar ni una línea.
   */
  async catalogo(params: { skip: number; take: number; busqueda?: string; categoriaId?: string }) {
    const where = this.whereBusqueda(params.busqueda, params.categoriaId);
    const select = {
      id: true,
      codigo: true,
      nombre: true,
      imagen: true,
      porcentajeItbis: true,
      tipo: true,
      variantes: {
        take: 1,
        orderBy: { createdAt: 'asc' as const },
        select: { precios: { where: { listaPrecio: 'GENERAL', vigenteHasta: null }, select: { precioVenta: true }, take: 1 } },
      },
    } as const;
    const [filas, total] = await Promise.all([
      this.db.producto.findMany({ where, orderBy: { nombre: 'asc' }, skip: params.skip, take: params.take, select }),
      this.db.producto.count({ where }),
    ]);
    const datos = filas.map(({ variantes, ...producto }) => ({ ...producto, precios: variantes[0]?.precios ?? [] }));
    return [datos, total] as const;
  }

  buscarPorId(id: string) {
    return this.db.producto.findUniqueOrThrow({
      where: { id },
      include: { componentes: { include: { componente: true } }, categoria: { select: { id: true, nombre: true } } },
    });
  }

  /** Para el upsert por código de la importación masiva (Fase 3e). */
  buscarPorCodigo(codigo: string) {
    return this.db.producto.findFirst({ where: { codigo } });
  }

  /**
   * Trae TODAS las variantes de cada producto (no solo la "por defecto",
   * a diferencia de `catalogo()`) para agregar código de barras/stock de
   * las 4 (Fase 3e, export): el precio GENERAL mostrado sigue el mismo
   * criterio de "variante representativa" que `catalogo()` (la más
   * antigua, `orderBy: createdAt asc` deja `variantes[0]` como esa),
   * pero código de barras y stock se agregan sobre todas.
   */
  exportarDatos() {
    return this.db.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: {
        codigo: true,
        nombre: true,
        tipo: true,
        unidadMedida: true,
        porcentajeItbis: true,
        categoria: { select: { nombre: true } },
        variantes: {
          orderBy: { createdAt: 'asc' },
          select: {
            codigoBarras: true,
            precios: { where: { listaPrecio: 'GENERAL', vigenteHasta: null }, select: { precioVenta: true }, take: 1 },
            stock: { select: { cantidadActual: true } },
          },
        },
      },
    });
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

  /**
   * `componentes: undefined` (no se envió el campo) deja los componentes
   * existentes tal cual. `componentes: []` o con elementos SÍ los
   * reemplaza — mismo patrón que RemisionesRepository/ComprasRepository
   * para reemplazar líneas: borrar todas las existentes y crear las
   * nuevas, dentro de una sola transacción.
   */
  actualizar(id: string, dto: Partial<CrearProductoDto>) {
    // `atributos` no es una columna de Producto — ya se procesó aparte en
    // ProductosService.actualizar() (ver VariantesService.generarCombinaciones)
    // antes de llegar acá.
    const { componentes, atributos, ...datosProducto } = dto;
    void atributos;
    return this.db.$transaction(async (tx) => {
      const producto = await tx.producto.update({ where: { id }, data: datosProducto });
      if (componentes !== undefined) {
        await tx.componenteCombo.deleteMany({ where: { comboId: id } });
        if (componentes.length) {
          await tx.componenteCombo.createMany({
            data: componentes.map((c) => ({ comboId: id, componenteId: c.productoId, cantidad: c.cantidad })),
          });
        }
      }
      return producto;
    });
  }
}
