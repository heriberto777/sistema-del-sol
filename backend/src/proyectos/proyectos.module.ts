import { Module } from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { ProyectosController } from './proyectos.controller';
import { ProyectosRepository } from './proyectos.repository';
import { ProyectosIaService } from './proyectos-ia.service';
import { TareasProyectoService } from './tareas-proyecto.service';
import { TareasProyectoController } from './tareas-proyecto.controller';
import { ClientesModule } from '../clientes/clientes.module';
import { NominaModule } from '../nomina/nomina.module';
import { ConfiguracionesModule } from '../configuraciones/configuraciones.module';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { IaModule } from '../ia/ia.module';
import { WhatsappConfigModule } from '../whatsapp-config/whatsapp-config.module';
import { HitosProyectoCronService } from './hitos-proyecto-cron.service';
import { TareasProyectoCronService } from './tareas-proyecto-cron.service';
import { PresupuestoProyectoListener } from './presupuesto-proyecto.listener';
import { HitoFacturaAnuladaListener } from './hito-factura-anulada.listener';

/**
 * Plugin de Proyectos (Fase 1) — ver plugins/proyectos/README.md. Gateado
 * por módulo (`@RequiereModulo('proyectos')` en ambos controllers) igual
 * que Inmobiliaria/Tienda Online: el tenant lo recibe vía su Plan o un
 * `TenantModuloOverride` puntual desde /plataforma/tenants, nunca lo
 * activa el propio tenant.
 *
 * `IaModule`/`WhatsappConfigModule` (Fase 7) — "Generar tareas con IA"
 * reusa `ConversacionIaService` + la config de IA que el tenant ya cargó
 * para el Bot de WhatsApp, ver `ProyectosIaService`.
 */
@Module({
  imports: [ClientesModule, NominaModule, ConfiguracionesModule, FacturacionModule, IaModule, WhatsappConfigModule],
  controllers: [ProyectosController, TareasProyectoController],
  providers: [
    ProyectosService,
    ProyectosRepository,
    ProyectosIaService,
    TareasProyectoService,
    HitosProyectoCronService,
    TareasProyectoCronService,
    PresupuestoProyectoListener,
    HitoFacturaAnuladaListener,
  ],
  exports: [ProyectosRepository],
})
export class ProyectosModule {}
