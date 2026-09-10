import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { sumarCiclo } from '../facturacion-plataforma/sumar-ciclo.util';

/**
 * Modelo 2 (administradora de alquileres) — corre fuera de cualquier
 * contexto de tenant (es un cron, no un request), mismo criterio que
 * HitosProyectoCronService/FacturasPlataformaCronService: inyecta
 * `PrismaService` directo, nunca `TenantPrismaService` (Scope.REQUEST,
 * incompatible con un provider de `@Cron`). Solo genera el registro
 * `CobroAlquiler` PENDIENTE — cobrar al inquilino (con o sin Factura) y
 * liquidar al propietario son acciones manuales del admin
 * (`InmobiliariaService.marcarCobradoAlquiler`/`liquidarPropietarioAlquiler`).
 */
@Injectable()
export class CobrosAlquilerCronService {
  private readonly logger = new Logger(CobrosAlquilerCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async generarCobrosDelDia() {
    const hoy = new Date();
    const contratos = await this.prisma.contratoPropiedad.findMany({
      where: { administracionActiva: true, estado: 'ACTIVO', proximoCobroAlquilerEn: { lte: hoy } },
    });

    let generados = 0;
    for (const contrato of contratos) {
      const fechaPeriodo = contrato.proximoCobroAlquilerEn ?? hoy;
      const periodo = fechaPeriodo.toISOString().slice(0, 7); // "AAAA-MM"
      const montoAlquiler = Number(contrato.monto);
      const porcentaje = contrato.porcentajeComisionAdministracion ? Number(contrato.porcentajeComisionAdministracion) : 0;
      const montoComisionAdmin = Math.round(montoAlquiler * porcentaje) / 100;

      try {
        await this.prisma.cobroAlquiler.create({
          data: {
            tenantId: contrato.tenantId,
            contratoPropiedadId: contrato.id,
            periodo,
            montoAlquiler,
            porcentajeComisionAdmin: contrato.porcentajeComisionAdministracion,
            montoComisionAdmin,
            montoPropietario: montoAlquiler - montoComisionAdmin,
          },
        });
        generados++;
      } catch (error) {
        // P2002 = ya existe un cobro para este contrato+periodo (reintento
        // del propio cron, o generado a mano) — no es un error real, solo
        // se salta la creación y se avanza igual la fecha más abajo.
        if ((error as { code?: string })?.code !== 'P2002') throw error;
      }

      await this.prisma.contratoPropiedad.update({
        where: { id: contrato.id },
        data: { proximoCobroAlquilerEn: sumarCiclo(fechaPeriodo, 'MENSUAL') },
      });
    }

    this.logger.log(`Alquileres: ${generados} cobro(s) de renta generado(s)`);
    return generados;
  }
}
