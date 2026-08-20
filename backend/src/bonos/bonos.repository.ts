import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BonosRepository {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crearLote(bonos: { tenantId: string; codigo: string; montoInicial: number; fechaVencimiento: Date }[]) {
    return this.db.$transaction(async (tx) => {
      const creados = [];
      for (const b of bonos) {
        creados.push(await tx.bono.create({ data: { ...b, saldoActual: b.montoInicial } }));
      }
      return creados;
    });
  }

  listar(busqueda?: string) {
    return this.db.bono.findMany({
      where: busqueda ? { codigo: { contains: busqueda, mode: 'insensitive' } } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  buscarPorId(id: string) {
    return this.db.bono.findUniqueOrThrow({ where: { id } });
  }

  anular(id: string) {
    return this.db.bono.update({ where: { id }, data: { estado: 'ANULADO' } });
  }

  /** Usado por FacturacionService.crear() dentro de su propia transacción — necesita ESE tx para que el SET LOCAL de RLS de esa transacción cubra esta consulta (ver docs/ARCHITECTURE.md). */
  buscarPorCodigoEnTx(tx: Prisma.TransactionClient, tenantId: string, codigo: string) {
    return tx.bono.findFirst({ where: { tenantId, codigo } });
  }

  descontarSaldoEnTx(tx: Prisma.TransactionClient, id: string, saldoNuevo: number, estado: 'ACTIVO' | 'AGOTADO') {
    return tx.bono.update({ where: { id }, data: { saldoActual: saldoNuevo, estado } });
  }

  /** Cron fuera de contexto de tenant (ver RecordatoriosService/FacturasPlataformaCronService) — PrismaService global, cruza todos los tenants en una sola query. */
  marcarVencidosGlobal(ahora: Date) {
    return this.prisma.bono.updateMany({ where: { estado: 'ACTIVO', fechaVencimiento: { lt: ahora } }, data: { estado: 'VENCIDO' } });
  }
}
