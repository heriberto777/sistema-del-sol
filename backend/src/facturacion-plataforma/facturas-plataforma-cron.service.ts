import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SuscripcionesRepository } from './suscripciones.repository';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { FacturasPlataformaService } from './facturas-plataforma.service';
import { ReglasNotificacionRepository } from './reglas-notificacion/reglas-notificacion.repository';
import { PlataformaConfigRepository } from '../plataforma-config/plataforma-config.repository';
import { TenantsService } from '../tenants/tenants.service';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
/** Compara solo año/mes/día (UTC) — `fechaVencimiento` conserva la hora de creación, el cron corre siempre a las 8am. */
function fechaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Corre fuera de cualquier contexto de tenant (es un cron, no un
 * request), igual que RecordatoriosService — usa PrismaService global
 * (vía los repositorios), nunca TenantPrismaService.
 */
@Injectable()
export class FacturasPlataformaCronService {
  private readonly logger = new Logger(FacturasPlataformaCronService.name);

  constructor(
    private readonly suscripcionesRepository: SuscripcionesRepository,
    private readonly facturasPlataformaRepository: FacturasPlataformaRepository,
    private readonly facturasPlataformaService: FacturasPlataformaService,
    private readonly reglasNotificacionRepository: ReglasNotificacionRepository,
    private readonly plataformaConfigRepository: PlataformaConfigRepository,
    private readonly tenantsService: TenantsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async generarFacturasDelDia() {
    const hoy = new Date();
    const suscripciones = await this.suscripcionesRepository.listarActivasParaFacturar(hoy);

    let generadas = 0;
    // generarDesdeSuscripcion ya avanza fechaProximoCorte internamente
    // (ver el comentario ahí) — hacerlo también acá duplicaría el avance
    // y saltearía un ciclo entero de facturación.
    //
    // Cada suscripción se aísla con su propio try/catch — sin esto, una
    // excepción en CUALQUIER tenant (NCF agotado, módulo con lógica rota,
    // etc.) corta el `for` y deja sin facturar a TODO el resto del lote
    // del día, en silencio (bug real encontrado en la auditoría).
    for (const suscripcion of suscripciones) {
      try {
        await this.facturasPlataformaService.generarDesdeSuscripcion(suscripcion);
        generadas++;
      } catch (error) {
        this.logger.error(`No se pudo generar la factura de la suscripción ${suscripcion.id} (tenant ${suscripcion.tenantId}): ${(error as Error).message}`, (error as Error).stack);
      }
    }

    this.logger.log(`Facturación de plataforma: ${generadas}/${suscripciones.length} factura(s) generada(s)`);
    return generadas;
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async marcarVencidasYAplicarMora() {
    const hoy = new Date();
    const vencidas = await this.facturasPlataformaRepository.listarVencidasPendientes(hoy);

    let marcadas = 0;
    for (const factura of vencidas) {
      try {
        await this.facturasPlataformaService.marcarVencidaConMora(factura.id, Number(factura.suscripcion.feeMoraPct));
        marcadas++;
      } catch (error) {
        this.logger.error(`No se pudo marcar VENCIDA la factura ${factura.id} (tenant ${factura.tenantId}): ${(error as Error).message}`, (error as Error).stack);
      }
    }

    this.logger.log(`Facturación de plataforma: ${marcadas}/${vencidas.length} factura(s) marcada(s) VENCIDA con mora aplicada`);
    return marcadas;
  }

  /**
   * Fase 4 — "esa richness se construye después, sobre este mismo cron"
   * (ver docs/ARCHITECTURE.md): por cada factura PENDIENTE/VENCIDA y cada
   * regla activa, si HOY coincide con `fechaVencimiento + offsetDias`,
   * despacha el aviso — una sola vez por (factura, regla), controlado por
   * `NotificacionVencimientoEnviada` (evita reenvíos si el cron corre 2
   * veces el mismo día o el proceso se reinicia a mitad de la corrida).
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async enviarNotificacionesVencimiento() {
    const hoy = new Date();
    const [facturas, reglas] = await Promise.all([
      this.facturasPlataformaRepository.listarPendientesOVencidas(),
      this.reglasNotificacionRepository.listarActivas(),
    ]);

    let enviadas = 0;
    for (const factura of facturas) {
      for (const regla of reglas) {
        const fechaObjetivo = new Date(factura.fechaVencimiento.getTime() + regla.offsetDias * MS_POR_DIA);
        if (fechaISO(fechaObjetivo) !== fechaISO(hoy)) continue;

        try {
          if (await this.reglasNotificacionRepository.yaFueEnviada(factura.id, regla.id)) continue;
          await this.facturasPlataformaService.notificarPorRegla(factura.id, regla.offsetDias, regla.canal);
          await this.reglasNotificacionRepository.registrarEnviada(factura.id, regla.id);
          enviadas++;
        } catch (error) {
          this.logger.error(`No se pudo enviar la notificación de vencimiento (factura ${factura.id}, regla ${regla.id}): ${(error as Error).message}`, (error as Error).stack);
        }
      }
    }

    this.logger.log(`Notificaciones de vencimiento: ${enviadas} enviada(s)`);
    return enviadas;
  }

  /**
   * Fase 4 (última) — auto-suspensión: un tenant ACTIVO con alguna factura
   * VENCIDA hace más de `diasParaAutoSuspender` días (configurable en
   * /plataforma/configuracion, default 10) pasa a SUSPENDIDO. Reusa
   * TenantsRepository.actualizar (mismo mecanismo que el botón manual
   * "Suspender" de /plataforma/tenants) y notifica con el mismo criterio
   * que las demás notificaciones de FacturasPlataformaService.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async suspenderTenantsMorosos() {
    const hoy = new Date();
    const { diasParaAutoSuspender } = await this.plataformaConfigRepository.obtenerOCrear();
    const morosas = await this.facturasPlataformaRepository.listarMorosasVencidasHace(diasParaAutoSuspender, hoy);

    let suspendidos = 0;
    for (const factura of morosas) {
      try {
        await this.tenantsService.actualizar(factura.tenantId, { estado: 'SUSPENDIDO' });
        await this.facturasPlataformaService.notificarFactura(factura.tenantId, factura.id, 'auto_suspendido');
        suspendidos++;
      } catch (error) {
        this.logger.error(`No se pudo auto-suspender el tenant ${factura.tenantId} (factura ${factura.id}): ${(error as Error).message}`, (error as Error).stack);
      }
    }

    this.logger.log(`Auto-suspensión: ${suspendidos}/${morosas.length} tenant(s) suspendido(s) por mora`);
    return suspendidos;
  }
}
