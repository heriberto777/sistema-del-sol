import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
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

/**
 * Plugin de CRM (Fase 1) — ver el artifact de diseño publicado. Gateado
 * por `@RequiereModulo('crm')` en cada controller, igual que Proyectos/
 * Inmobiliaria: el tenant lo recibe vía un `TenantModuloOverride` puntual
 * desde /plataforma/tenants, nunca lo activa el propio tenant (no está en
 * ningún PLANES_BASE a propósito, ver modulos-base.ts).
 */
@Module({
  imports: [ClientesModule],
  controllers: [LeadsController, EtapasPipelineController, OportunidadesController, ActividadesCrmController],
  providers: [
    LeadsService,
    LeadsRepository,
    EtapasPipelineService,
    EtapasPipelineRepository,
    OportunidadesService,
    OportunidadesRepository,
    ActividadesCrmService,
    ActividadesCrmRepository,
  ],
})
export class CrmModule {}
