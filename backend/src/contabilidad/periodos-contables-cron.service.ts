import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { rangoDelMesSiguiente } from './periodos-contables.util';

const DIAS_ANTICIPACION = 5;

/**
 * Corre fuera de cualquier contexto de tenant (es un cron, no un request) —
 * mismo criterio que LotesCronService/RecordatoriosService: `PrismaService`
 * DIRECTO, nunca un repositorio que dependa de `TenantPrismaService`
 * (Scope.REQUEST — `@nestjs/schedule` no puede registrar un provider así,
 * y solo avisa con un warning, nunca falla ruidoso: BonosCronService tuvo
 * exactamente este bug, su cron nunca había corrido).
 *
 * Crea el PeriodoContable del mes siguiente, en ABIERTO, para cada tenant
 * que todavía no lo tenga, cuando faltan DIAS_ANTICIPACION días o menos
 * para que termine el mes en curso. Es la pieza que evita el riesgo
 * discutido con el usuario: si nadie lo creara a mano, facturar/vender en
 * POS se detendría el día 1 del mes siguiente (Fase 2 agrega esa
 * validación a Facturación) — con este cron, nunca hace falta acordarse.
 */
@Injectable()
export class PeriodosContablesCronService {
  private readonly logger = new Logger(PeriodosContablesCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async crearPeriodosProximos() {
    const hoy = new Date();
    // UTC, no local — consistente con rangoDelMesSiguiente de abajo (ver su
    // comentario); para este conteo aproximado de "días restantes" la
    // diferencia es irrelevante en la práctica (el margen de
    // DIAS_ANTICIPACION ya la absorbe), pero mezclar convenciones confunde
    // a quien lea esto después.
    const finDeMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0));
    const diasRestantes = Math.ceil((finDeMes.getTime() - hoy.getTime()) / 86_400_000);
    if (diasRestantes > DIAS_ANTICIPACION) {
      this.logger.log(`Períodos contables: faltan ${diasRestantes} día(s) para fin de mes, todavía no toca crear el siguiente.`);
      return 0;
    }

    const { fechaInicio, fechaFin } = rangoDelMesSiguiente(hoy);
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });

    let creados = 0;
    for (const tenant of tenants) {
      const existe = await this.prisma.periodoContable.findUnique({
        where: { tenantId_fechaInicio: { tenantId: tenant.id, fechaInicio } },
      });
      if (!existe) {
        await this.prisma.periodoContable.create({ data: { tenantId: tenant.id, fechaInicio, fechaFin } });
        creados++;
      }
    }

    this.logger.log(`Períodos contables: ${creados} período(s) nuevo(s) creado(s) para el mes siguiente.`);
    return creados;
  }
}
