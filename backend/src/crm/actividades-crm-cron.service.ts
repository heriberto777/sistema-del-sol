import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

/**
 * Corre fuera de contexto de tenant (cron, no request) — `PrismaService`
 * global + `tenantId` explícito en el evento, nunca `TenantPrismaService`
 * (mismo criterio que TareasPersonalesCronService/HitosProyectoCronService).
 *
 * Mismo criterio que TareaPersonal: el aviso es un solo disparo el DÍA
 * que llega `fechaProgramada`, sin ventana de "N días antes" — `avisoEnviado`
 * evita reavisar mientras la actividad siga sin completarse. No hay
 * ningún flujo hoy que edite `fechaProgramada` después de creada una
 * actividad, así que a diferencia de TareaPersonal.recordatorioEnviado
 * no hace falta resetear este flag en ningún lado todavía.
 */
@Injectable()
export class ActividadesCrmCronService {
  private readonly logger = new Logger(ActividadesCrmCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async avisarActividadesQueVencenHoy() {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const inicioManana = new Date(inicioHoy);
    inicioManana.setDate(inicioManana.getDate() + 1);

    const actividades = await this.prisma.actividadCrm.findMany({
      where: {
        completada: false,
        fechaProgramada: { gte: inicioHoy, lt: inicioManana },
        avisoEnviado: false,
      },
    });

    for (const actividad of actividades) {
      this.eventBus.emit(EVENTOS.CRM_ACTIVIDAD_VENCE_HOY, {
        tenantId: actividad.tenantId,
        actividadId: actividad.id,
        descripcion: actividad.descripcion,
        usuarioId: actividad.usuarioId,
      });
      await this.prisma.actividadCrm.update({ where: { id: actividad.id }, data: { avisoEnviado: true } });
    }

    this.logger.log(`CRM: ${actividades.length} aviso(s) de actividad vencida hoy enviado(s)`);
    return actividades.length;
  }
}
