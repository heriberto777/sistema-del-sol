import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS, GastoMenorCreadoPayload, HorasProyectoRegistradasPayload } from '../event-bus/events';
import { CONFIGURACIONES_BASE } from '../tenants/roles-base';
import { costoHora } from './costo-hora.util';

const CLAVE_HORAS_LABORABLES_MES = 'PROYECTOS_HORAS_LABORABLES_MES';

/**
 * Reacciona a eventos de OTROS módulos (GASTO_MENOR_CREADO, de Gastos
 * Menores) y del propio plugin (HORAS_PROYECTO_REGISTRADAS) para avisar
 * cuando el costo real de un proyecto supera su presupuesto — mismo
 * criterio de "el emisor no conoce a sus consumidores" que el resto del
 * Event Bus.
 *
 * Inyecta `PrismaService` DIRECTO (no `ProyectosRepository`,
 * `ProyectosService` ni `ConfiguracionesService`) — mismo motivo que
 * `HitosProyectoCronService`: todos dependen de `TenantPrismaService`
 * (`Scope.REQUEST`), y un `@OnEvent` en un provider REQUEST-scoped queda
 * registrado con un warning silencioso y jamás corre (ver el comentario
 * completo en `hitos-proyecto-cron.service.ts` / `lotes-cron.service.ts`).
 * Por eso duplica acá a mano el cálculo de costo de horas/gastos que
 * `ProyectosRepository`/`ProyectosService.calcularRentabilidad` ya
 * resuelven para el request HTTP normal — mismo criterio de duplicación a
 * propósito que `GastosMenoresRepository.obtenerModalidadFacturacion`.
 */
@Injectable()
export class PresupuestoProyectoListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  @OnEvent(EVENTOS.HORAS_PROYECTO_REGISTRADAS)
  async alRegistrarHoras(payload: HorasProyectoRegistradasPayload) {
    await this.verificarPresupuesto(payload.tenantId, payload.proyectoId);
  }

  @OnEvent(EVENTOS.GASTO_MENOR_CREADO)
  async alCrearGastoMenor(payload: GastoMenorCreadoPayload) {
    const gasto = await this.prisma.gastoMenor.findUnique({ where: { id: payload.gastoMenorId } });
    if (gasto?.proyectoId) {
      await this.verificarPresupuesto(payload.tenantId, gasto.proyectoId);
    }
  }

  private async verificarPresupuesto(tenantId: string, proyectoId: string) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: { responsable: true },
    });
    if (!proyecto || proyecto.presupuesto === null || proyecto.alertaPresupuestoEnviada) return;

    const horasPorEmpleado = await this.prisma.registroHoraProyecto.groupBy({
      by: ['empleadoId'],
      where: { tarea: { proyectoId } },
      _sum: { horas: true },
    });

    let costoHoras = 0;
    if (horasPorEmpleado.length > 0) {
      const configuracion = await this.prisma.configuracion.findUnique({
        where: { tenantId_clave: { tenantId, clave: CLAVE_HORAS_LABORABLES_MES } },
      });
      const horasLaborablesMes = configuracion?.valor ?? CONFIGURACIONES_BASE[CLAVE_HORAS_LABORABLES_MES];

      for (const fila of horasPorEmpleado) {
        const empleado = await this.prisma.empleado.findUnique({ where: { id: fila.empleadoId } });
        if (!empleado) continue;
        const horas = Number(fila._sum.horas ?? 0);
        costoHoras += horas * costoHora(empleado.salarioBrutoMensual.toString(), horasLaborablesMes);
      }
    }

    const gastosAgregados = await this.prisma.gastoMenor.aggregate({
      where: { proyectoId },
      _sum: { total: true },
    });
    const costoGastos = Number(gastosAgregados._sum.total ?? 0);

    const costoTotal = costoHoras + costoGastos;
    if (costoTotal <= Number(proyecto.presupuesto)) return;

    this.eventBus.emit(EVENTOS.PROYECTO_PRESUPUESTO_SUPERADO, {
      tenantId,
      proyectoId,
      proyectoNombre: proyecto.nombre,
      presupuesto: proyecto.presupuesto.toString(),
      costoTotal: costoTotal.toString(),
      responsableUserId: proyecto.responsable?.userId ?? null,
    });
    await this.prisma.proyecto.update({ where: { id: proyectoId }, data: { alertaPresupuestoEnviada: true } });
  }
}
