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

  /** `componentes` no es una columna de Producto — se crea aparte, en la misma transacción, como filas de ComponenteCombo. */
  crear(dto: CrearProductoDto, tenantId: string) {
    const { componentes, ...datosProducto } = dto;
    return this.db.$transaction(async (tx) => {
      const producto = await tx.producto.create({ data: { ...datosProducto, tenantId } });
      if (componentes?.length) {
        await tx.componenteCombo.createMany({
          data: componentes.map((c) => ({ comboId: producto.id, componenteId: c.productoId, cantidad: c.cantidad })),
        });
      }
      return producto;
    });
  }

  private whereBusqueda(busqueda?: string, categoria?: string) {
    return {
      activo: true,
      ...(busqueda
        ? {
            OR: [
              { nombre: { contains: busqueda, mode: 'insensitive' as const } },
              { codigo: { contains: busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(categoria ? { categoria } : {}),
    };
  }

  // Select explícito que EXCLUYE `imagen` a propósito — es el listado que
  // alimenta Productos.tsx y ComboboxBusqueda, no debe cargar blobs de
  // imagen en cada tecla de búsqueda. Ver `catalogo()` para el uso que sí
  // la necesita. Mismos campos que ya devolvía este endpoint antes de
  // agregar la columna `imagen`, para no romper a ningún consumidor.
  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = this.whereBusqueda(params.busqueda);
    const select = {
      id: true,
      codigo: true,
      nombre: true,
      categoria: true,
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

  /** Para el catálogo de POS (Modelo C) — sí trae `imagen` y el precio vigente, para pintar la grilla sin un round-trip por producto. */
  catalogo(params: { skip: number; take: number; busqueda?: string; categoria?: string }) {
    const where = this.whereBusqueda(params.busqueda, params.categoria);
    const select = {
      id: true,
      codigo: true,
      nombre: true,
      imagen: true,
      porcentajeItbis: true,
      tipo: true,
      precios: { where: { listaPrecio: 'GENERAL', vigenteHasta: null }, select: { precioVenta: true }, take: 1 },
    } as const;
    return Promise.all([
      this.db.producto.findMany({ where, orderBy: { nombre: 'asc' }, skip: params.skip, take: params.take, select }),
      this.db.producto.count({ where }),
    ]);
  }

  /** Chips de categoría del catálogo de POS — valores distintos no vacíos, texto libre (no hay tabla `Categoria`). */
  async categoriasDistintas(): Promise<string[]> {
    const filas = await this.db.producto.findMany({
      where: { activo: true, categoria: { not: null } },
      distinct: ['categoria'],
      select: { categoria: true },
      orderBy: { categoria: 'asc' },
    });
    return filas.map((f) => f.categoria).filter((c): c is string => !!c);
  }

  buscarPorId(id: string) {
    return this.db.producto.findUniqueOrThrow({
      where: { id },
      include: { componentes: { include: { componente: true } } },
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
    const { componentes, ...datosProducto } = dto;
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
