import { Module } from '@nestjs/common';
import { InmobiliariaService } from './inmobiliaria.service';
import { InmobiliariaController } from './inmobiliaria.controller';
import { InmobiliariaRepository } from './inmobiliaria.repository';
import { InmobiliariaPublicaService } from './inmobiliaria-publica.service';
import { InmobiliariaPublicaController } from './inmobiliaria-publica.controller';
import { NominaModule } from '../nomina/nomina.module';
import { ClientesModule } from '../clientes/clientes.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { InmobiliariaContratosController } from './inmobiliaria-contratos.controller';
import { InmobiliariaAlquileresController } from './inmobiliaria-alquileres.controller';
import { AlertasBusquedaPropiedadCronService } from './alertas-busqueda-propiedad-cron.service';
import { CobrosAlquilerCronService } from './cobros-alquiler-cron.service';

/**
 * Plugin de Inmobiliaria (Fase 1) — ver plugins/inmobiliaria/README.md.
 * Gateado por módulo (`@RequiereModulo('inmobiliaria')`) igual que
 * Proyectos/Ecommerce: el tenant lo recibe vía su Plan o un
 * `TenantModuloOverride` puntual desde /plataforma/tenants, nunca lo
 * activa el propio tenant.
 */
@Module({
  imports: [NominaModule, ClientesModule, NotificacionesModule, FacturacionModule, ProyectosModule],
  controllers: [InmobiliariaController, InmobiliariaContratosController, InmobiliariaAlquileresController, InmobiliariaPublicaController],
  providers: [
    InmobiliariaService,
    InmobiliariaRepository,
    InmobiliariaPublicaService,
    AlertasBusquedaPropiedadCronService,
    CobrosAlquilerCronService,
  ],
})
export class InmobiliariaModule {}
