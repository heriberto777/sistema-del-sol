import { Module } from '@nestjs/common';
import { TravelService } from './travel.service';
import { TravelController } from './travel.controller';
import { TravelRepository } from './travel.repository';
import { ClientesModule } from '../clientes/clientes.module';
import { CorrelativosModule } from '../correlativos/correlativos.module';
import { FacturacionModule } from '../facturacion/facturacion.module';

/**
 * Plugin Travel Management — Fase 0 ("esqueleto sin proveedor", ver
 * docs/Sistema_del_Sol_Travel_Management_Plugin.md y el análisis de
 * arquitectura). Gateado por módulo (`@RequiereModulo('travel')` en el
 * controller) igual que Inmobiliaria/Proyectos — el tenant lo recibe vía
 * su Plan o un `TenantModuloOverride` puntual desde /plataforma/tenants.
 */
@Module({
  imports: [ClientesModule, CorrelativosModule, FacturacionModule],
  controllers: [TravelController],
  providers: [TravelService, TravelRepository],
})
export class TravelModule {}
