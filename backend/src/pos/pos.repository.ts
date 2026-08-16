import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EstadoTurnoCaja, TipoMovimientoCaja } from '@prisma/client';

const INCLUDE_TURNO = { movimientos: true, facturas: { select: { id: true, total: true, metodoPago: true, estado: true } } } as const;

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

  listar(params: { skip: number; take: number }) {
    return Promise.all([
      this.db.turnoCaja.findMany({ orderBy: { abiertoEn: 'desc' }, skip: params.skip, take: params.take }),
      this.db.turnoCaja.count(),
    ]);
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

  cerrarTurno(id: string, params: { montoFinalContado: number; montoEsperado: number; diferencia: number }) {
    return this.db.turnoCaja.update({
      where: { id },
      data: { ...params, estado: 'CERRADO' as EstadoTurnoCaja, cerradoEn: new Date() },
      include: INCLUDE_TURNO,
    });
  }
}
