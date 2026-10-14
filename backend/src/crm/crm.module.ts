import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';
import { LealtadModule } from '../lealtad/lealtad.module';
import { WhatsappBotModule } from '../whatsapp-bot/whatsapp-bot.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './leads.repository';
import { LeadsEventosService } from './leads-eventos.service';
import { EtapasPipelineController } from './etapas-pipeline.controller';
import { EtapasPipelineService } from './etapas-pipeline.service';
import { EtapasPipelineRepository } from './etapas-pipeline.repository';
import { OportunidadesController } from './oportunidades.controller';
import { OportunidadesService } from './oportunidades.service';
import { OportunidadesRepository } from './oportunidades.repository';
import { OportunidadesEventosService } from './oportunidades-eventos.service';
import { ActividadesCrmController } from './actividades-crm.controller';
import { ActividadesCrmService } from './actividades-crm.service';
import { ActividadesCrmRepository } from './actividades-crm.repository';
import { ActividadesCrmCronService } from './actividades-crm-cron.service';
import { ClienteTimelineController } from './cliente-timeline.controller';
import { ClienteTimelineService } from './cliente-timeline.service';
import { ClienteTimelineRepository } from './cliente-timeline.repository';
import { CrmReportesController } from './crm-reportes.controller';
import { CrmReportesService } from './crm-reportes.service';
import { CrmReportesRepository } from './crm-reportes.repository';
import { MetasVentaController } from './metas-venta.controller';
import { MetasVentaService } from './metas-venta.service';
import { MetasVentaRepository } from './metas-venta.repository';

/**
 * Plugin de CRM (Fase 1 + Fase 2 + Fase 3) — ver el artifact de diseño
 * publicado. Gateado por `@RequiereModulo('crm')` en cada controller,
 * igual que Proyectos/Inmobiliaria: el tenant lo recibe vía un
 * `TenantModuloOverride` puntual desde /plataforma/tenants, nunca lo
 * activa el propio tenant (no está en ningún PLANES_BASE a propósito,
 * ver modulos-base.ts).
 *
 * Fase 2 agrega: conversión Lead→Cliente (ClientesModule, ya importado en
 * Fase 1), "Ganar y generar cotización" (CotizacionesModule) y la ficha
 * 360° del cliente (LealtadModule + WhatsappBotModule, ambos de solo
 * lectura acá — el CRM nunca escribe en esos dominios).
 *
 * Fase 3 agrega: dashboard de conversión/forecast/ranking
 * (CrmReportesService), metas de venta por vendedor/mes
 * (MetasVentaService) y el cron de actividades vencidas
 * (ActividadesCrmCronService, sin controller — @Cron se registra solo,
 * ScheduleModule ya es global en AppModule).
 */
@Module({
  imports: [ClientesModule, CotizacionesModule, LealtadModule, WhatsappBotModule],
  controllers: [
    LeadsController,
    EtapasPipelineController,
    OportunidadesController,
    ActividadesCrmController,
    ClienteTimelineController,
    CrmReportesController,
    MetasVentaController,
  ],
  providers: [
    LeadsService,
    LeadsRepository,
    LeadsEventosService,
    EtapasPipelineService,
    EtapasPipelineRepository,
    OportunidadesService,
    OportunidadesRepository,
    OportunidadesEventosService,
    ActividadesCrmService,
    ActividadesCrmRepository,
    ActividadesCrmCronService,
    ClienteTimelineService,
    ClienteTimelineRepository,
    CrmReportesService,
    CrmReportesRepository,
    MetasVentaService,
    MetasVentaRepository,
  ],
})
export class CrmModule {}
