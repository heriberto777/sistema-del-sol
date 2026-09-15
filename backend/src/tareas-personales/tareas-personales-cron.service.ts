import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

/**
 * Corre fuera de contexto de tenant (cron, no request) — `PrismaService`
 * global + `tenantId` explícito en el evento, nunca `TenantPrismaService`
 * (mismo criterio que HitosProyectoCronService; ver el comentario largo
 * de ese archivo sobre por qué un provider REQUEST-scoped rompe `@Cron`
 * en silencio).
 *
 * A diferencia de HitoProyecto (ventana de "N días antes", configurable
 * por tenant), acá el aviso es un solo disparo el DÍA que llega `fecha`
 * — decisión explícita del usuario, sin tabla de reglas. `recordatorioEnviado`
 * evita reavisar mientras la tarea siga con la misma fecha.
 */
@Injectable()
export class TareasPersonalesCronService {
  private readonly logger = new Logger(TareasPersonalesCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async avisarTareasQueVencenHoy() {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const inicioManana = new Date(inicioHoy);
    inicioManana.setDate(inicioManana.getDate() + 1);

    const tareas = await this.prisma.tareaPersonal.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'EN_CURSO', 'EN_ESPERA'] },
        fecha: { gte: inicioHoy, lt: inicioManana },
        recordatorioEnviado: false,
      },
    });

    for (const tarea of tareas) {
      this.eventBus.emit(EVENTOS.TAREA_PERSONAL_VENCE_HOY, {
        tenantId: tarea.tenantId,
        tareaId: tarea.id,
        tareaTitulo: tarea.titulo,
        usuarioId: tarea.usuarioId,
      });
      await this.prisma.tareaPersonal.update({ where: { id: tarea.id }, data: { recordatorioEnviado: true } });
    }

    this.logger.log(`Mis Tareas: ${tareas.length} aviso(s) de vencimiento hoy enviado(s)`);
    return tareas.length;
  }
}
