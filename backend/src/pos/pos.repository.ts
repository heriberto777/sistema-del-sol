import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EstadoTurnoCaja, MotivoMovimientoCaja, Prisma, TipoMovimientoCaja } from '@prisma/client';

const INCLUDE_TURNO = {
  movimientos: true,
  facturas: {
    select: {
      id: true,
      ncf: true,
      total: true,
      estado: true,
      formaPago: { select: { nombre: true, esEfectivo: true } },
      vendedorEmpleado: { select: { nombre: true } },
      // Ledger real de pago dividido — para que el frontend pueda previsualizar
      // el efectivo esperado exacto (una venta con pago mixto solo cuenta su
      // porción efectivo, no todo el total) y armar el desglose por TODAS
      // las formas de pago (ítem E-6, antes solo se distinguía efectivo).
      // Ver calcularMovimientoEfectivo.
      pagosVenta: { select: { monto: true, formaPago: { select: { id: true, nombre: true, esEfectivo: true } } } },
      // Ítem "marcar factura devuelta" — mismo criterio que
      // FacturacionRepository.listar(), para que "Ventas del turno"
      // marque la venta original que ya tiene una nota de crédito.
      _count: { select: { notasRelacionadas: { where: { tipoFactura: 'NOTA_CREDITO', estado: 'EMITIDA' } } } },
    },
  },
  cajero: { select: { id: true, nombre: true } },
  cerradoPor: { select: { id: true, nombre: true } },
} as const;

const INCLUDE_VENTA_APARCADA = {
  cliente: { select: { id: true, nombre: true } },
  vendedorEmpleado: { select: { id: true, nombre: true } },
  lineas: {
    include: { producto: { select: { codigo: true, nombre: true } } },
  },
} as const;

@Injectable()
export class PosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  buscarTurnoAbierto(bodegaId: string) {
    return this.db.turnoCaja.findFirst({ where: { bodegaId, estado: 'ABIERTO' }, include: INCLUDE_TURNO });
  }

  crearTurno(params: { tenantId: string; bodegaId: string; cajaId?: string; cajeroId: string; montoInicial: number }) {
    return this.db.turnoCaja.create({ data: params, include: INCLUDE_TURNO });
  }

  buscarPorId(id: string) {
    return this.db.turnoCaja.findUniqueOrThrow({ where: { id }, include: INCLUDE_TURNO });
  }

  listar(params: {
    skip: number;
    take: number;
    cajeroId?: string;
    estado?: EstadoTurnoCaja;
    desde?: Date;
    hasta?: Date;
    busqueda?: string;
  }) {
    const where = {
      ...(params.cajeroId && { cajeroId: params.cajeroId }),
      ...(params.estado && { estado: params.estado }),
      ...((params.desde || params.hasta) && {
        abiertoEn: { ...(params.desde && { gte: params.desde }), ...(params.hasta && { lte: params.hasta }) },
      }),
      ...(params.busqueda && { cajero: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } }),
    };
    return Promise.all([
      this.db.turnoCaja.findMany({ where, orderBy: { abiertoEn: 'desc' }, skip: params.skip, take: params.take, include: INCLUDE_TURNO }),
      this.db.turnoCaja.count({ where }),
    ]);
  }

  /**
   * Ítem "buscador de Devolución" — a diferencia del listado de
   * `data.facturas` de un turno puntual, esto busca en TODO el tenant
   * (backend de `registrarDevolucion` ya lo permitía sin restricción de
   * turno) las ventas CONTADO emitidas por número/NCF/cliente. Mismo
   * patrón que `FacturacionRepository.buscarParaNota`.
   */
  buscarParaDevolver(params: { skip?: number; take?: number; busqueda?: string }) {
    const where = {
      estado: 'EMITIDA' as const,
      tipoFactura: 'CONTADO' as const,
      ...(params.busqueda
        ? {
            OR: [
              { numero: { contains: params.busqueda, mode: 'insensitive' as const } },
              { ncf: { contains: params.busqueda, mode: 'insensitive' as const } },
              { cliente: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.db.factura.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' as const },
        include: {
          cliente: { select: { nombre: true } },
          _count: { select: { notasRelacionadas: { where: { tipoFactura: 'NOTA_CREDITO', estado: 'EMITIDA' } } } },
        },
      }),
      this.db.factura.count({ where }),
    ]);
  }

  /** Cajeros distintos que han tenido al menos un turno — para poblar el filtro sin requerir el permiso admin.usuarios de GET /admin/usuarios. */
  async listarCajeros() {
    const turnos = await this.db.turnoCaja.findMany({
      distinct: ['cajeroId'],
      select: { cajero: { select: { id: true, nombre: true } } },
    });
    return turnos.map((t) => t.cajero);
  }

  /**
   * Reporte-dashboard de cierres (ítem E-6) — solo turnos ya resueltos
   * (`CERRADO`/`PENDIENTE_REVISION`, que son los únicos con `diferencia`
   * calculada; `ABIERTO` queda fuera). "Total ventas" suma `Factura.total`
   * de esos turnos (todas las formas de pago, no solo lo que afecta el
   * arqueo de efectivo) — distinto de `montoEsperado`, que es específico
   * de efectivo.
   */
  async reporteCierres(params: { desde?: Date; hasta?: Date; cajeroId?: string; bodegaId?: string }) {
    const EPSILON = 0.01;
    const where = {
      estado: { in: ['CERRADO', 'PENDIENTE_REVISION'] as EstadoTurnoCaja[] },
      ...(params.desde || params.hasta ? { cerradoEn: { gte: params.desde, lte: params.hasta } } : {}),
      ...(params.cajeroId ? { cajeroId: params.cajeroId } : {}),
      ...(params.bodegaId ? { bodegaId: params.bodegaId } : {}),
    };
    const turnos = await this.db.turnoCaja.findMany({ where, select: { id: true, diferencia: true } });
    const ids = turnos.map((t) => t.id);
    const diferencias = turnos.map((t) => Number(t.diferencia ?? 0));
    const sobrantes = diferencias.filter((d) => d > EPSILON);
    const faltantes = diferencias.filter((d) => d < -EPSILON);
    const exactas = diferencias.filter((d) => Math.abs(d) <= EPSILON);

    const ventasAgg = ids.length
      ? await this.db.factura.aggregate({ where: { turnoCajaId: { in: ids }, estado: 'EMITIDA' }, _sum: { total: true } })
      : { _sum: { total: null } };

    return {
      totalVentas: Number(ventasAgg._sum.total ?? 0),
      cantidadSesiones: turnos.length,
      sobrantes: { cantidad: sobrantes.length, monto: sobrantes.reduce((acc, d) => acc + d, 0) },
      faltantes: { cantidad: faltantes.length, monto: faltantes.reduce((acc, d) => acc + d, 0) },
      exactas: exactas.length,
      diferenciaTotal: diferencias.reduce((acc, d) => acc + d, 0),
    };
  }

  crearMovimiento(params: { turnoId: string; tipo: TipoMovimientoCaja; monto: number; concepto: string; motivoTipo?: MotivoMovimientoCaja }) {
    return this.db.movimientoCaja.create({ data: params });
  }

  /**
   * Suma de PagoVenta con formaPago.esEfectivo de este turno (no
   * Factura.total — una venta con pago dividido solo cuenta la porción
   * efectivo real) más entradas de caja, menos salidas — la base de
   * `montoEsperado` al cerrar. Una devolución (NOTA_CREDITO, ver
   * PosService.registrarDevolucion) tiene su propio PagoVenta con monto
   * negativo, así que resta sola sin lógica especial acá.
   */
  async calcularMovimientoEfectivo(turnoId: string) {
    const [ventasEfectivo, entradas, salidas] = await Promise.all([
      this.db.pagoVenta.aggregate({
        where: { formaPago: { esEfectivo: true }, factura: { turnoCajaId: turnoId, estado: 'EMITIDA' } },
        _sum: { monto: true },
      }),
      this.db.movimientoCaja.aggregate({ where: { turnoId, tipo: 'ENTRADA' }, _sum: { monto: true } }),
      this.db.movimientoCaja.aggregate({ where: { turnoId, tipo: 'SALIDA' }, _sum: { monto: true } }),
    ]);
    return {
      ventasEfectivo: Number(ventasEfectivo._sum.monto ?? 0),
      entradas: Number(entradas._sum.monto ?? 0),
      salidas: Number(salidas._sum.monto ?? 0),
    };
  }

  cerrarTurno(
    id: string,
    params: {
      montoFinalContado: number;
      montoEsperado: number;
      diferencia: number;
      cerradoPorId: string;
      justificacionDiferencia?: string;
      estado: EstadoTurnoCaja;
    },
  ) {
    return this.db.turnoCaja.update({
      where: { id },
      data: { ...params, cerradoEn: new Date() },
      include: INCLUDE_TURNO,
    });
  }

  /** PENDIENTE_REVISION -> CERRADO (ítem E-6). */
  marcarRevisado(id: string, revisadoPorId: string) {
    return this.db.turnoCaja.update({
      where: { id },
      data: { estado: 'CERRADO' as EstadoTurnoCaja, revisadoPorId, revisadoEn: new Date() },
      include: INCLUDE_TURNO,
    });
  }

  guardarVenta(params: {
    tenantId: string;
    turnoCajaId: string;
    clienteId?: string;
    vendedorEmpleadoId?: string;
    nota?: string;
    lineas: { productoId: string; varianteId: string; cantidad: number; precioUnitario: number; porcentajeItbis: number; descuento?: number }[];
  }) {
    return this.db.ventaAparcada.create({
      data: {
        tenantId: params.tenantId,
        turnoCajaId: params.turnoCajaId,
        clienteId: params.clienteId,
        vendedorEmpleadoId: params.vendedorEmpleadoId,
        nota: params.nota,
        lineas: { create: params.lineas },
      },
      include: INCLUDE_VENTA_APARCADA,
    });
  }

  listarGuardadas(turnoCajaId: string) {
    return this.db.ventaAparcada.findMany({
      where: { turnoCajaId },
      include: INCLUDE_VENTA_APARCADA,
      orderBy: { createdAt: 'desc' },
    });
  }

  buscarGuardadaPorId(id: string) {
    return this.db.ventaAparcada.findUniqueOrThrow({ where: { id }, include: INCLUDE_VENTA_APARCADA });
  }

  eliminarGuardada(id: string) {
    return this.db.ventaAparcada.delete({ where: { id } });
  }

  /** Borrador silencioso del carrito activo (ver comentario en schema.prisma) — upsert, un registro por turno. */
  guardarBorrador(params: {
    tenantId: string;
    turnoCajaId: string;
    clienteId?: string;
    vendedorEmpleadoId?: string;
    listaPrecio?: string;
    tipoFactura?: string;
    comprobanteFiscal?: string;
    lineas: unknown;
  }) {
    const datosComunes = {
      clienteId: params.clienteId ?? null,
      vendedorEmpleadoId: params.vendedorEmpleadoId ?? null,
      listaPrecio: params.listaPrecio ?? null,
      tipoFactura: params.tipoFactura ?? null,
      comprobanteFiscal: params.comprobanteFiscal ?? null,
      lineas: params.lineas as Prisma.InputJsonValue,
    };
    return this.db.carritoBorrador.upsert({
      where: { turnoCajaId: params.turnoCajaId },
      create: { tenantId: params.tenantId, turnoCajaId: params.turnoCajaId, ...datosComunes },
      update: datosComunes,
    });
  }

  buscarBorrador(turnoCajaId: string) {
    return this.db.carritoBorrador.findUnique({
      where: { turnoCajaId },
      include: {
        cliente: { select: { id: true, nombre: true } },
        vendedorEmpleado: { select: { id: true, nombre: true } },
      },
    });
  }

  /** deleteMany (no delete) — no debe romper si ya no había borrador (ej. doble llamada). */
  eliminarBorrador(turnoCajaId: string) {
    return this.db.carritoBorrador.deleteMany({ where: { turnoCajaId } });
  }
}
