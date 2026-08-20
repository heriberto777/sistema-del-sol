import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Corre fuera de cualquier contexto de tenant (es un cron, no un
 * request) — mismo criterio que RecordatoriosService/
 * FacturasPlataformaCronService: una sola query cruza todos los
 * tenants vía PrismaService global, sin necesidad de iterar tenant por
 * tenant porque es un simple cambio de estado, no una acción con
 * efectos secundarios por fila.
 *
 * Inyecta `PrismaService` DIRECTO (no `BonosRepository`) — a propósito.
 * `BonosRepository` también depende de `TenantPrismaService`, que es
 * `Scope.REQUEST`; NestJS propaga ese scope hacia arriba en TODO el
 * grafo de dependencias, así que cualquier provider que dependa de
 * `BonosRepository` (aunque solo use su método `*Global`, que ya usa
 * `PrismaService` global) queda REQUEST-scoped también — y `@Cron` no
 * puede registrar un provider sin una única instancia estática (bug
 * real, encontrado al agregar `LotesCronService` en Fase 5b: el mismo
 * warning de `@nestjs/schedule` ya llevaba dado para este cron desde
 * que se implementó Bonos en Fase 4c — nunca había corrido).
 */
@Injectable()
export class BonosCronService {
  private readonly logger = new Logger(BonosCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async marcarVencidos() {
    const { count } = await this.prisma.bono.updateMany({
      where: { estado: 'ACTIVO', fechaVencimiento: { lt: new Date() } },
      data: { estado: 'VENCIDO' },
    });
    this.logger.log(`Bonos: ${count} bono(s) marcado(s) VENCIDO`);
    return count;
  }
}
