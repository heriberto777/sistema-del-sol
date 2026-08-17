import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SuscripcionesRepository } from './suscripciones.repository';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { FacturasPlataformaService } from './facturas-plataforma.service';
import { sumarCiclo } from './sumar-ciclo.util';

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
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async generarFacturasDelDia() {
    const hoy = new Date();
    const suscripciones = await this.suscripcionesRepository.listarActivasParaFacturar(hoy);

    for (const suscripcion of suscripciones) {
      await this.facturasPlataformaService.generarDesdeSuscripcion(suscripcion);
      await this.suscripcionesRepository.avanzarProximoCorte(
        suscripcion.id,
        sumarCiclo(suscripcion.fechaProximoCorte, suscripcion.plan.cicloFacturacion),
      );
    }

    this.logger.log(`Facturación de plataforma: ${suscripciones.length} factura(s) generada(s)`);
    return suscripciones.length;
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async marcarVencidasYAplicarMora() {
    const hoy = new Date();
    const vencidas = await this.facturasPlataformaRepository.listarVencidasPendientes(hoy);

    for (const factura of vencidas) {
      await this.facturasPlataformaService.marcarVencidaConMora(factura.id, Number(factura.suscripcion.feeMoraPct));
    }

    this.logger.log(`Facturación de plataforma: ${vencidas.length} factura(s) marcada(s) VENCIDA con mora aplicada`);
    return vencidas.length;
  }
}
