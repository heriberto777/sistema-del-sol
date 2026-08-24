import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Corre fuera de cualquier contexto de tenant (es un cron, no un
 * request), cruzando todos los tenants con una sola query — mismo
 * criterio que `LotesCronService`/`RecordatoriosService`. Inyecta
 * `PrismaService` DIRECTO, sin pasar por `LealtadRepository` (que
 * depende de `TenantPrismaService`, `Scope.REQUEST`) — un `@Cron` no
 * puede registrarse sobre un provider request-scoped (bug real ya
 * encontrado con `BonosCronService`, ver `LotesCronService`).
 */
@Injectable()
export class LealtadExpiracionCronService {
  private readonly logger = new Logger(LealtadExpiracionCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expirarPuntosVencidos() {
    const lotesVencidos = await this.prisma.movimientoLealtad.findMany({
      where: { tipo: 'ACUMULACION', anulado: false, puntosDisponibles: { gt: 0 }, expiraEn: { lte: new Date() } },
    });

    for (const lote of lotesVencidos) {
      await this.prisma.movimientoLealtad.create({
        data: {
          tenantId: lote.tenantId,
          clienteId: lote.clienteId,
          tipo: 'EXPIRACION',
          puntos: -lote.puntosDisponibles,
          motivo: `Expiración de puntos ganados el ${lote.createdAt.toISOString().slice(0, 10)}`,
        },
      });
      await this.prisma.cliente.update({ where: { id: lote.clienteId }, data: { puntosLealtad: { decrement: lote.puntosDisponibles } } });
      await this.prisma.movimientoLealtad.update({ where: { id: lote.id }, data: { puntosDisponibles: 0 } });
    }

    this.logger.log(`Lealtad: ${lotesVencidos.length} lote(s) de puntos expirado(s)`);
    return lotesVencidos.length;
  }
}
