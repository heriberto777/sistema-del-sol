import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

const DIAS_ALERTA_VENCIMIENTO = 30;

/**
 * Corre fuera de cualquier contexto de tenant (es un cron, no un
 * request) — mismo criterio que RecordatoriosService/
 * FacturasPlataformaCronService: una sola query cruza todos los
 * tenants vía PrismaService global. Umbral fijo (30 días, no
 * configurable por tenant en v1 — ver ARCHITECTURE.md).
 *
 * Inyecta `PrismaService` DIRECTO (no `InventarioRepository`) — a
 * propósito. `InventarioRepository` también depende de
 * `TenantPrismaService`, que es `Scope.REQUEST`; NestJS propaga ese
 * scope hacia arriba en TODO el grafo de dependencias, así que
 * cualquier provider que dependa de `InventarioRepository` queda
 * REQUEST-scoped también — y `@Cron` no puede registrar un provider
 * sin una única instancia estática (`@nestjs/schedule` solo avisa con
 * un warning, nunca falla ruidoso — bug real encontrado así:
 * `BonosCronService` tenía exactamente este mismo problema desde Fase
 * 4c y su cron nunca había corrido).
 */
@Injectable()
export class LotesCronService {
  private readonly logger = new Logger(LotesCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async avisarLotesPorVencer() {
    const limite = new Date();
    limite.setDate(limite.getDate() + DIAS_ALERTA_VENCIMIENTO);

    const lotes = await this.prisma.lote.findMany({
      where: { cantidadActual: { gt: 0 }, fechaVencimiento: { lte: limite } },
      include: { variante: { include: { producto: true } } },
    });

    for (const lote of lotes) {
      this.eventBus.emit(EVENTOS.LOTE_POR_VENCER, {
        tenantId: lote.tenantId,
        loteId: lote.id,
        productoNombre: lote.variante.producto.nombre,
        numeroLote: lote.numeroLote,
        fechaVencimiento: lote.fechaVencimiento.toISOString(),
        cantidadActual: lote.cantidadActual.toString(),
      });
    }

    this.logger.log(`Vencimientos: ${lotes.length} lote(s) por vencer en los próximos ${DIAS_ALERTA_VENCIMIENTO} días`);
    return lotes.length;
  }
}
