import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

interface VarianteParaContar {
  productoId: string;
  varianteId: string;
  cantidadActual: number;
}

const INCLUDE_LINEA = {
  producto: true,
  variante: { include: { valoresAtributo: { include: { valorAtributo: { include: { atributo: true } } } } } },
} as const;

/**
 * Conteo Físico vs Teórico — un solo repositorio para el documento
 * completo (cabecera + líneas), mismo criterio de "no fragmentar de más"
 * que `AjustesInventarioRepository`/`facturacion.repository.ts`.
 */
@Injectable()
export class ConteoFisicoRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  buscarAbiertoPorBodega(bodegaId: string) {
    return this.db.conteoFisico.findFirst({ where: { bodegaId, estado: 'ABIERTO' } });
  }

  /**
   * Alcance TOTAL — todo el `Stock` contable de la bodega. Excluye
   * SERVICIO/COMBO (`Producto.tipo`, no tienen fila propia en Stock de
   * todos modos) y productos que controlan vencimiento: un conteo por
   * variante no captura DE QUÉ LOTE sale la diferencia, y
   * `AjustesInventarioService.cambiarEstado` exige `loteId`/`numeroLote`
   * explícito para esos productos — fuera de alcance de esta primera
   * versión (limitación documentada, no un olvido).
   */
  async todoElStockDeLaBodega(bodegaId: string): Promise<VarianteParaContar[]> {
    const filas = await this.db.stock.findMany({
      where: { bodegaId, variante: { producto: { tipo: 'PRODUCTO', controlaVencimiento: false } } },
      select: { varianteId: true, cantidadActual: true, variante: { select: { productoId: true } } },
    });
    return filas.map((f) => ({ productoId: f.variante.productoId, varianteId: f.varianteId, cantidadActual: Number(f.cantidadActual) }));
  }

  /**
   * Alcance SELECCION — arranca de `VarianteProducto`, no de `Stock`: una
   * variante nunca movida en esta bodega no tiene fila de `Stock` todavía
   * y aun así debe entrar al conteo con `cantidadTeorica: 0`.
   */
  async stockDeVariantesEnBodega(varianteIds: string[], bodegaId: string): Promise<VarianteParaContar[]> {
    const variantes = await this.db.varianteProducto.findMany({
      where: { id: { in: varianteIds }, producto: { tipo: 'PRODUCTO', controlaVencimiento: false } },
      select: { id: true, productoId: true, stock: { where: { bodegaId }, select: { cantidadActual: true } } },
    });
    return variantes.map((v) => ({
      productoId: v.productoId,
      varianteId: v.id,
      cantidadActual: Number(v.stock[0]?.cantidadActual ?? 0),
    }));
  }

  /** Participa en la transacción del correlativo (`ConteoFisicoService.crear`) — todo o nada. */
  crearEnTx(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      numero: string;
      bodegaId: string;
      alcance: 'TOTAL' | 'SELECCION';
      notas?: string;
      userId: string;
      variantes: VarianteParaContar[];
    },
  ) {
    return tx.conteoFisico.create({
      data: {
        tenantId: params.tenantId,
        numero: params.numero,
        bodegaId: params.bodegaId,
        alcance: params.alcance,
        notas: params.notas,
        userId: params.userId,
        lineas: {
          create: params.variantes.map((v) => ({
            productoId: v.productoId,
            varianteId: v.varianteId,
            cantidadTeorica: v.cantidadActual,
          })),
        },
      },
      include: { lineas: true },
    });
  }

  /**
   * Aplana `linea.variante.valoresAtributo` a `linea.valoresAtributo`
   * (mismo criterio que `InventarioRepository.listarStockPorBodega`) para
   * que el frontend no tenga que navegar la forma cruda de Prisma — nunca
   * spreadea el resto de campos de `VarianteProducto` sobre la línea
   * (mismo cuidado que el ítem E-12 de Alertas de Inventario: pisaría
   * `linea.id` con el id de la variante).
   */
  async buscarPorId(id: string) {
    const conteo = await this.db.conteoFisico.findUniqueOrThrow({
      where: { id },
      include: {
        bodega: true,
        user: { select: { id: true, nombre: true } },
        ajuste: { select: { id: true, numero: true } },
        lineas: { include: INCLUDE_LINEA },
      },
    });
    return {
      ...conteo,
      lineas: conteo.lineas.map(({ variante, ...linea }) => ({
        ...linea,
        valoresAtributo: variante.valoresAtributo.map((va) => ({ atributo: va.valorAtributo.atributo.nombre, valor: va.valorAtributo.valor })),
      })),
    };
  }

  listar(params: { skip: number; take: number; busqueda?: string; bodegaId?: string; estado?: string }) {
    const where = {
      ...(params.bodegaId ? { bodegaId: params.bodegaId } : {}),
      ...(params.estado ? { estado: params.estado as never } : {}),
      ...(params.busqueda
        ? { OR: [{ numero: { contains: params.busqueda, mode: 'insensitive' as const } }, { bodega: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } }] }
        : {}),
    };
    return Promise.all([
      this.db.conteoFisico.findMany({
        where,
        orderBy: { fechaInicio: 'desc' },
        include: { bodega: true, lineas: { select: { cantidadContada: true } } },
        skip: params.skip,
        take: params.take,
      }),
      this.db.conteoFisico.count({ where }),
    ]);
  }

  /**
   * `lineaConteoFisico` NO tiene `tenantId` propio (tabla hija, mismo
   * patrón que `LineaAjusteInventario`) — por eso este método nunca se
   * llama con un `lineaId` crudo del cliente sin validar antes que
   * pertenece a un `ConteoFisico` ya resuelto por `buscarPorId` (tenant-
   * scoped). Ver `ConteoFisicoService.capturarLinea` (evita el mismo IDOR
   * ya documentado en ARCHITECTURE.md para tablas hijas sin tenantId).
   */
  actualizarLinea(lineaId: string, cantidadContada: number, userId: string) {
    return this.db.lineaConteoFisico.update({
      where: { id: lineaId },
      data: { cantidadContada, contadoPorId: userId, contadoEn: new Date() },
    });
  }

  marcarAplicado(id: string, ajusteId?: string) {
    return this.db.conteoFisico.update({ where: { id }, data: { estado: 'APLICADO', fechaAplicado: new Date(), ajusteId } });
  }

  cancelar(id: string) {
    return this.db.conteoFisico.update({ where: { id }, data: { estado: 'CANCELADO' } });
  }
}
