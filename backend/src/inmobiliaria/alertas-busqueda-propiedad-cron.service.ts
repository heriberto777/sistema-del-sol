import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailChannel } from '../notificaciones/canales/email.channel';

/**
 * Fase 4 — avisa por email a quien dejó una alerta de búsqueda guardada en
 * el catálogo público cuando aparece una propiedad ACTIVA nueva que
 * coincide con sus criterios. Corre fuera de un request HTTP (cron), mismo
 * criterio que HitosProyectoCronService: `PrismaService` global, nunca
 * `TenantPrismaService`.
 *
 * `ultimaNotificacionEn` evita reavisar la misma propiedad dos veces —
 * cada corrida solo mira propiedades creadas DESPUÉS del último aviso (o
 * desde que se guardó la alerta, si nunca se avisó).
 */
@Injectable()
export class AlertasBusquedaPropiedadCronService {
  private readonly logger = new Logger(AlertasBusquedaPropiedadCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailChannel: EmailChannel,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async avisarNuevasCoincidencias() {
    const alertas = await this.prisma.alertaBusquedaPropiedad.findMany({
      where: { activa: true },
      include: { tenant: { select: { subdominio: true, nombre: true } } },
    });

    let enviados = 0;
    for (const alerta of alertas) {
      const desde = alerta.ultimaNotificacionEn ?? alerta.createdAt;
      const propiedades = await this.prisma.propiedad.findMany({
        where: {
          tenantId: alerta.tenantId,
          estado: 'ACTIVA',
          createdAt: { gt: desde },
          ...(alerta.operacion ? { operacion: alerta.operacion } : {}),
          ...(alerta.tipo ? { tipo: alerta.tipo } : {}),
          ...(alerta.ubicacion ? { ubicacion: { contains: alerta.ubicacion, mode: 'insensitive' } } : {}),
          ...(alerta.precioMax !== null ? { precio: { lte: alerta.precioMax } } : {}),
          ...(alerta.habitacionesMin !== null ? { habitaciones: { gte: alerta.habitacionesMin } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (propiedades.length > 0) {
        await this.enviarAviso(alerta.email, alerta.tenant.nombre, alerta.tenant.subdominio, propiedades, alerta.tenantId);
        enviados++;
      }
      await this.prisma.alertaBusquedaPropiedad.update({ where: { id: alerta.id }, data: { ultimaNotificacionEn: new Date() } });
    }

    this.logger.log(`Alertas de búsqueda: ${enviados} email(s) enviado(s) de ${alertas.length} alerta(s) activa(s)`);
  }

  private async enviarAviso(
    email: string,
    tenantNombre: string,
    subdominio: string,
    propiedades: { id: string; titulo: string; precio: unknown; moneda: string }[],
    tenantId: string,
  ) {
    const base = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const items = propiedades
      .map((p) => {
        const url = `${base}/inmobiliaria/${subdominio}/${p.id}`;
        const precio = `${p.moneda === 'DOP' ? 'RD$' : 'US$'} ${Number(p.precio).toLocaleString('es-DO')}`;
        return `<li><a href="${url}">${p.titulo}</a> — ${precio}</li>`;
      })
      .join('');
    const cuerpo = `<p>Encontramos ${propiedades.length} propiedad(es) nueva(s) que coinciden con tu búsqueda en ${tenantNombre}:</p><ul>${items}</ul>`;
    await this.emailChannel.enviar(email, `Nuevas propiedades en ${tenantNombre}`, cuerpo, undefined, tenantId);
  }
}
