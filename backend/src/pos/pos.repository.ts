import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EstadoTurnoCaja, TipoMovimientoCaja } from '@prisma/client';

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
      // porción efectivo, no todo el total). Ver calcularMovimientoEfectivo.
      pagosVenta: { select: { monto: true, formaPago: { select: { esEfectivo: true } } } },
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

  crearTurno(params: { tenantId: string; bodegaId: string; cajeroId: string; montoInicial: number }) {
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

  /** Cajeros distintos que han tenido al menos un turno — para poblar el filtro sin requerir el permiso admin.usuarios de GET /admin/usuarios. */
  async listarCajeros() {
    const turnos = await this.db.turnoCaja.findMany({
      distinct: ['cajeroId'],
      select: { cajero: { select: { id: true, nombre: true } } },
    });
    return turnos.map((t) => t.cajero);
  }

  crearMovimiento(params: { turnoId: string; tipo: TipoMovimientoCaja; monto: number; concepto: string }) {
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
    params: { montoFinalContado: number; montoEsperado: number; diferencia: number; cerradoPorId: string; justificacionDiferencia?: string },
  ) {
    return this.db.turnoCaja.update({
      where: { id },
      data: { ...params, estado: 'CERRADO' as EstadoTurnoCaja, cerradoEn: new Date() },
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
}
