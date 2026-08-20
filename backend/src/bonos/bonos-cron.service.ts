import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BonosRepository } from './bonos.repository';

/**
 * Corre fuera de cualquier contexto de tenant (es un cron, no un
 * request) — mismo criterio que RecordatoriosService/
 * FacturasPlataformaCronService: una sola query cruza todos los
 * tenants vía PrismaService global, sin necesidad de iterar tenant por
 * tenant porque es un simple cambio de estado, no una acción con
 * efectos secundarios por fila.
 */
@Injectable()
export class BonosCronService {
  private readonly logger = new Logger(BonosCronService.name);

  constructor(private readonly bonosRepository: BonosRepository) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async marcarVencidos() {
    const { count } = await this.bonosRepository.marcarVencidosGlobal(new Date());
    this.logger.log(`Bonos: ${count} bono(s) marcado(s) VENCIDO`);
    return count;
  }
}
