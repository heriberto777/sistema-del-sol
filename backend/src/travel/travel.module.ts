import { Module } from '@nestjs/common';
import { TravelService } from './travel.service';
import { TravelController } from './travel.controller';
import { TravelVuelosController } from './travel-vuelos.controller';
import { TravelLedgerController } from './travel-ledger.controller';
import { TravelWebhookController } from './travel-webhook.controller';
import { TravelReglaMarkupController } from './travel-regla-markup.controller';
import { TravelReconciliacionController } from './travel-reconciliacion.controller';
import { TravelRepository } from './travel.repository';
import { TravelReglaMarkupRepository } from './travel-regla-markup.repository';
import { TravelReglaMarkupService } from './travel-regla-markup.service';
import { TravelReconciliacionService } from './travel-reconciliacion.service';
import { DuffelWebhookService } from './duffel-webhook.service';
import { ClientesModule } from '../clientes/clientes.module';
import { CorrelativosModule } from '../correlativos/correlativos.module';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { TasasCambioModule } from '../tasas-cambio/tasas-cambio.module';
import { DuffelAdapter } from './providers/duffel.adapter';
import { TravelProviderService } from './providers/travel-provider.service';

/**
 * Plugin Travel Management — Fase 0 (esqueleto sin proveedor) + Fase 1a
 * (DuffelAdapter real) + Fase 1b (búsqueda/reserva/cancelación reales +
 * ledger del Balance compartido — ver
 * docs/Sistema_del_Sol_Travel_Management_Plugin.md y el análisis de
 * arquitectura). Gateado por módulo (`@RequiereModulo('travel')` en cada
 * controller) igual que Inmobiliaria/Proyectos — el tenant lo recibe vía
 * su Plan o un `TenantModuloOverride` puntual desde /plataforma/tenants.
 */
@Module({
  imports: [ClientesModule, CorrelativosModule, FacturacionModule, TasasCambioModule],
  controllers: [TravelController, TravelVuelosController, TravelLedgerController, TravelWebhookController, TravelReglaMarkupController, TravelReconciliacionController],
  providers: [TravelService, TravelRepository, DuffelAdapter, TravelProviderService, DuffelWebhookService, TravelReglaMarkupRepository, TravelReglaMarkupService, TravelReconciliacionService],
  exports: [TravelProviderService],
})
export class TravelModule {}
