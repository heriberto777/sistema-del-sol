import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';
import { LealtadModule } from '../lealtad/lealtad.module';
import { WhatsappBotModule } from '../whatsapp-bot/whatsapp-bot.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './leads.repository';
import { EtapasPipelineController } from './etapas-pipeline.controller';
import { EtapasPipelineService } from './etapas-pipeline.service';
import { EtapasPipelineRepository } from './etapas-pipeline.repository';
import { OportunidadesController } from './oportunidades.controller';
import { OportunidadesService } from './oportunidades.service';
import { OportunidadesRepository } from './oportunidades.repository';
import { ActividadesCrmController } from './actividades-crm.controller';
import { ActividadesCrmService } from './actividades-crm.service';
import { ActividadesCrmRepository } from './actividades-crm.repository';
import { ClienteTimelineController } from './cliente-timeline.controller';
import { ClienteTimelineService } from './cliente-timeline.service';
import { ClienteTimelineRepository } from './cliente-timeline.repository';

/**
 * Plugin de CRM (Fase 1 + Fase 2) — ver el artifact de diseño publicado.
 * Gateado por `@RequiereModulo('crm')` en cada controller, igual que
 * Proyectos/Inmobiliaria: el tenant lo recibe vía un
 * `TenantModuloOverride` puntual desde /plataforma/tenants, nunca lo
 * activa el propio tenant (no está en ningún PLANES_BASE a propósito,
 * ver modulos-base.ts).
 *
 * Fase 2 agrega: conversión Lead→Cliente (ClientesModule, ya importado en
 * Fase 1), "Ganar y generar cotización" (CotizacionesModule) y la ficha
 * 360° del cliente (LealtadModule + WhatsappBotModule, ambos de solo
 * lectura acá — el CRM nunca escribe en esos dominios).
 */
@Module({
  imports: [ClientesModule, CotizacionesModule, LealtadModule, WhatsappBotModule],
  controllers: [LeadsController, EtapasPipelineController, OportunidadesController, ActividadesCrmController, ClienteTimelineController],
  providers: [
    LeadsService,
    LeadsRepository,
    EtapasPipelineService,
    EtapasPipelineRepository,
    OportunidadesService,
    OportunidadesRepository,
    ActividadesCrmService,
    ActividadesCrmRepository,
    ClienteTimelineService,
    ClienteTimelineRepository,
  ],
})
export class CrmModule {}
