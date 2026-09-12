import { Module } from '@nestjs/common';
import { TravelService } from './travel.service';
import { TravelController } from './travel.controller';
import { TravelVuelosController } from './travel-vuelos.controller';
import { TravelLedgerController } from './travel-ledger.controller';
import { TravelRepository } from './travel.repository';
import { ClientesModule } from '../clientes/clientes.module';
import { CorrelativosModule } from '../correlativos/correlativos.module';
import { FacturacionModule } from '../facturacion/facturacion.module';
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
  imports: [ClientesModule, CorrelativosModule, FacturacionModule],
  controllers: [TravelController, TravelVuelosController, TravelLedgerController],
  providers: [TravelService, TravelRepository, DuffelAdapter, TravelProviderService],
  exports: [TravelProviderService],
})
export class TravelModule {}
