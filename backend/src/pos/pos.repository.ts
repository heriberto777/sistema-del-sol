import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EstadoTurnoCaja, TipoMovimientoCaja } from '@prisma/client';

const INCLUDE_TURNO = {
  movimientos: true,
  facturas: { select: { id: true, total: true, metodoPago: true, estado: true } },
  cajero: { select: { id: true, nombre: true } },
  cerradoPor: { select: { id: true, nombre: true } },
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

  listar(params: { skip: number; take: number; cajeroId?: string; estado?: EstadoTurnoCaja; desde?: Date; hasta?: Date }) {
    const where = {
      ...(params.cajeroId && { cajeroId: params.cajeroId }),
      ...(params.estado && { estado: params.estado }),
      ...((params.desde || params.hasta) && {
        abiertoEn: { ...(params.desde && { gte: params.desde }), ...(params.hasta && { lte: params.hasta }) },
      }),
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

  /** Suma de ventas en efectivo (facturas EMITIDA con metodoPago EFECTIVO) más entradas de caja, menos salidas — la base de `montoEsperado` al cerrar. */
  async calcularMovimientoEfectivo(turnoId: string) {
    const [ventasEfectivo, entradas, salidas] = await Promise.all([
      this.db.factura.aggregate({ where: { turnoCajaId: turnoId, metodoPago: 'EFECTIVO', estado: 'EMITIDA' }, _sum: { total: true } }),
      this.db.movimientoCaja.aggregate({ where: { turnoId, tipo: 'ENTRADA' }, _sum: { monto: true } }),
      this.db.movimientoCaja.aggregate({ where: { turnoId, tipo: 'SALIDA' }, _sum: { monto: true } }),
    ]);
    return {
      ventasEfectivo: Number(ventasEfectivo._sum.total ?? 0),
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
}
