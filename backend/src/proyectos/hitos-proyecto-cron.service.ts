import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CONFIGURACIONES_BASE } from '../tenants/roles-base';

const CLAVE_DIAS_ALERTA = 'PROYECTOS_DIAS_ALERTA_HITO';

/**
 * Corre fuera de cualquier contexto de tenant (es un cron, no un request)
 * — mismo criterio que LotesCronService/RecordatoriosService. A diferencia
 * de LotesCronService (umbral fijo), acá el umbral de días SÍ es
 * configurable por tenant (CONFIGURACIONES_BASE.PROYECTOS_DIAS_ALERTA_HITO)
 * — como no se puede empujar un umbral distinto por tenant a una sola
 * query SQL, se trae todo lo pendiente de avisar y se filtra en JS por
 * tenant, mismo criterio que FacturasPlataformaCronService itera reglas
 * por entidad.
 *
 * Inyecta `PrismaService` DIRECTO (no `ProyectosRepository` ni
 * `ConfiguracionesService`) — a propósito. Ambos dependen de
 * `TenantPrismaService`, que es `Scope.REQUEST`; NestJS propaga ese scope
 * hacia arriba en TODO el grafo de dependencias, así que cualquier
 * provider que dependa de ellos queda REQUEST-scoped también — y `@Cron`
 * no puede registrar un provider sin una única instancia estática
 * (`@nestjs/schedule` solo avisa con un warning, nunca falla ruidoso —
 * bug real encontrado así: `BonosCronService` tenía exactamente este
 * mismo problema desde Fase 4c y su cron nunca había corrido). Por eso
 * también se replica acá a mano la misma lógica de fallback de
 * `ConfiguracionesService.buscarValor` en vez de inyectarlo.
 */
@Injectable()
export class HitosProyectoCronService {
  private readonly logger = new Logger(HitosProyectoCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async avisarHitosPorVencer() {
    const hitos = await this.prisma.hitoProyecto.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'EN_CURSO'] },
        fechaObjetivo: { not: null },
        alertaVencimientoEnviada: false,
      },
      include: { proyecto: { include: { responsable: true } } },
    });

    let avisados = 0;
    for (const hito of hitos) {
      const configuracion = await this.prisma.configuracion.findUnique({
        where: { tenantId_clave: { tenantId: hito.tenantId, clave: CLAVE_DIAS_ALERTA } },
      });
      const dias = Number(configuracion?.valor ?? CONFIGURACIONES_BASE[CLAVE_DIAS_ALERTA]);
      const limite = new Date();
      limite.setDate(limite.getDate() + dias);

      if (hito.fechaObjetivo! > limite) continue; // todavía no entra en la ventana de ESTE tenant

      this.eventBus.emit(EVENTOS.HITO_PROYECTO_POR_VENCER, {
        tenantId: hito.tenantId,
        hitoId: hito.id,
        hitoNombre: hito.nombre,
        proyectoNombre: hito.proyecto.nombre,
        fechaObjetivo: hito.fechaObjetivo!.toISOString(),
        responsableUserId: hito.proyecto.responsable?.userId ?? null,
      });
      await this.prisma.hitoProyecto.update({ where: { id: hito.id }, data: { alertaVencimientoEnviada: true } });
      avisados++;
    }

    this.logger.log(`Hitos de proyecto: ${avisados} aviso(s) de vencimiento próximo enviado(s)`);
    return avisados;
  }
}
