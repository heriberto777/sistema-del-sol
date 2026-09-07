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

  /**
   * Devuelve `totalLineas`/`lineasContadas` ya calculados por conteo en
   * vez de embeber `lineas` completas (que con 1000+ artículos por conteo
   * sería un payload pesado solo para mostrar "X/Y contados" en la lista).
   * N+1 de 2 counts por fila aceptado a propósito: esta paginación es de
   * CONTEOS (decenas por página como mucho), no de líneas.
   */
  async listar(params: { skip: number; take: number; busqueda?: string; bodegaId?: string; estado?: string }) {
    const where = {
      ...(params.bodegaId ? { bodegaId: params.bodegaId } : {}),
      ...(params.estado ? { estado: params.estado as never } : {}),
      ...(params.busqueda
        ? { OR: [{ numero: { contains: params.busqueda, mode: 'insensitive' as const } }, { bodega: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } }] }
        : {}),
    };
    const [conteos, total] = await Promise.all([
      this.db.conteoFisico.findMany({
        where,
        orderBy: { fechaInicio: 'desc' },
        include: { bodega: true },
        skip: params.skip,
        take: params.take,
      }),
      this.db.conteoFisico.count({ where }),
    ]);

    const datos = await Promise.all(
      conteos.map(async (c) => {
        const [totalLineas, lineasContadas] = await Promise.all([
          this.db.lineaConteoFisico.count({ where: { conteoId: c.id } }),
          this.db.lineaConteoFisico.count({ where: { conteoId: c.id, cantidadContada: { not: null } } }),
        ]);
        return { ...c, totalLineas, lineasContadas };
      }),
    );

    return [datos, total] as const;
  }

  /**
   * Cabecera liviana para `GET /:id` — SIN el array de líneas (con 1000+
   * artículos por conteo, mandarlas todas de una sola respuesta HTTP es
   * justo lo que hay que evitar). Los agregados (`lineasConFaltante`,
   * `sumaFaltante`, etc.) alimentan el resumen del modal "Aplicar conteo"
   * (ver ConteoDetalle.tsx) sin necesitar la lista completa en el
   * frontend. Se calculan trayendo SOLO `{cantidadTeorica, cantidadContada}`
   * de todas las líneas (sin relaciones/nombres) — liviano, mismo
   * trade-off ya aceptado en `InventarioRepository.listarAlertas` (E-12)
   * para comparar columna contra columna, que Prisma no expresa en un
   * `where`.
   */
  async buscarResumen(id: string) {
    const conteo = await this.db.conteoFisico.findUniqueOrThrow({
      where: { id },
      include: {
        bodega: true,
        user: { select: { id: true, nombre: true } },
        ajuste: { select: { id: true, numero: true } },
      },
    });

    const lineas = await this.db.lineaConteoFisico.findMany({
      where: { conteoId: id },
      select: { cantidadTeorica: true, cantidadContada: true },
    });

    let lineasContadas = 0;
    let lineasConFaltante = 0;
    let lineasConSobrante = 0;
    let lineasSinDiferencia = 0;
    let sumaFaltante = 0;
    let sumaSobrante = 0;

    for (const linea of lineas) {
      if (linea.cantidadContada === null) continue;
      lineasContadas++;
      const teorica = Number(linea.cantidadTeorica);
      const contada = Number(linea.cantidadContada);
      if (contada < teorica) {
        lineasConFaltante++;
        sumaFaltante += teorica - contada;
      } else if (contada > teorica) {
        lineasConSobrante++;
        sumaSobrante += contada - teorica;
      } else {
        lineasSinDiferencia++;
      }
    }

    return {
      ...conteo,
      totalLineas: lineas.length,
      lineasContadas,
      lineasConFaltante,
      lineasConSobrante,
      lineasSinDiferencia,
      sumaFaltante,
      sumaSobrante,
    };
  }

  /**
   * Líneas paginadas y buscables/filtrables de UN conteo, para la tabla
   * de captura/revisión. `TODAS`/`CONTADAS`/`SIN_CONTAR` son filtros
   * literales sobre `cantidadContada IS (NOT) NULL` — paginan 100% en
   * SQL. `CON_FALTANTE`/`CON_SOBRANTE`/`SIN_DIFERENCIA` comparan
   * `cantidadContada` contra `cantidadTeorica` (columna contra columna,
   * Prisma no lo expresa en un `where`) — mismo trade-off ya aceptado en
   * `listarAlertas` (E-12): se trae el universo acotado por
   * `cantidadContada: {not: null}` y se filtra/pagina en JS.
   */
  async listarLineas(
    conteoId: string,
    params: { skip: number; take: number; busqueda?: string; filtro?: string },
  ) {
    const filtroBusqueda = params.busqueda
      ? {
          OR: [
            { producto: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
            { producto: { codigo: { contains: params.busqueda, mode: 'insensitive' as const } } },
            { variante: { sku: { contains: params.busqueda, mode: 'insensitive' as const } } },
            { variante: { codigoBarras: { contains: params.busqueda, mode: 'insensitive' as const } } },
          ],
        }
      : {};

    if (!params.filtro || params.filtro === 'TODAS' || params.filtro === 'CONTADAS' || params.filtro === 'SIN_CONTAR') {
      const where = {
        conteoId,
        ...filtroBusqueda,
        ...(params.filtro === 'CONTADAS' ? { cantidadContada: { not: null } } : {}),
        ...(params.filtro === 'SIN_CONTAR' ? { cantidadContada: null } : {}),
      };
      const [filas, total] = await Promise.all([
        this.db.lineaConteoFisico.findMany({
          where,
          include: INCLUDE_LINEA,
          orderBy: { producto: { nombre: 'asc' } },
          skip: params.skip,
          take: params.take,
        }),
        this.db.lineaConteoFisico.count({ where }),
      ]);
      const datos = filas.map(({ variante, ...linea }) => ({
        ...linea,
        valoresAtributo: variante.valoresAtributo.map((va) => ({ atributo: va.valorAtributo.atributo.nombre, valor: va.valorAtributo.valor })),
      }));
      return [datos, total] as const;
    }

    const where = { conteoId, cantidadContada: { not: null }, ...filtroBusqueda };
    const filas = await this.db.lineaConteoFisico.findMany({
      where,
      include: INCLUDE_LINEA,
      orderBy: { producto: { nombre: 'asc' } },
    });
    const filtradas = filas.filter((f) => {
      const teorica = Number(f.cantidadTeorica);
      const contada = Number(f.cantidadContada);
      if (params.filtro === 'CON_FALTANTE') return contada < teorica;
      if (params.filtro === 'CON_SOBRANTE') return contada > teorica;
      return contada === teorica; // SIN_DIFERENCIA
    });
    const pagina = filtradas.slice(params.skip, params.skip + params.take);
    const datos = pagina.map(({ variante, ...linea }) => ({
      ...linea,
      valoresAtributo: variante.valoresAtributo.map((va) => ({ atributo: va.valorAtributo.atributo.nombre, valor: va.valorAtributo.valor })),
    }));
    return [datos, filtradas.length] as const;
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
