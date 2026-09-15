import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

/**
 * Corre fuera de contexto de tenant (cron, no request) — `PrismaService`
 * global + `tenantId` explícito en el evento, nunca `TenantPrismaService`
 * (mismo criterio que HitosProyectoCronService).
 *
 * A diferencia de HitoProyecto (ventana de "N días antes", configurable
 * por tenant), acá el aviso es un solo disparo el DÍA que llega
 * `fechaVencimiento` — decisión explícita del usuario. Avisa a TODOS los
 * responsables con `Empleado.userId` vinculado, sin fallback a Admin
 * Total (mismo criterio que TAREA_PROYECTO_COMENTADA — un vencimiento de
 * tarea puntual es menos crítico que un hito del proyecto entero).
 */
@Injectable()
export class TareasProyectoCronService {
  private readonly logger = new Logger(TareasProyectoCronService.name);

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

    const tareas = await this.prisma.tareaProyecto.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'EN_CURSO', 'EN_REVISION'] },
        fechaVencimiento: { gte: inicioHoy, lt: inicioManana },
        recordatorioEnviado: false,
      },
      include: { proyecto: { select: { nombre: true } }, responsables: { include: { empleado: { select: { userId: true } } } } },
    });

    let avisadas = 0;
    for (const tarea of tareas) {
      const destinatariosUserId = tarea.responsables.map((r) => r.empleado.userId).filter((id): id is string => !!id);
      if (destinatariosUserId.length > 0) {
        this.eventBus.emit(EVENTOS.TAREA_PROYECTO_VENCE_HOY, {
          tenantId: tarea.tenantId,
          tareaId: tarea.id,
          tareaTitulo: tarea.titulo,
          proyectoNombre: tarea.proyecto.nombre,
          destinatariosUserId,
        });
        avisadas++;
      }
      await this.prisma.tareaProyecto.update({ where: { id: tarea.id }, data: { recordatorioEnviado: true } });
    }

    this.logger.log(`Tareas de proyecto: ${avisadas} aviso(s) de vencimiento hoy enviado(s) de ${tareas.length} tarea(s) vencidas hoy`);
    return avisadas;
  }
}
