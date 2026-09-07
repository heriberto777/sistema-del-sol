import { Module } from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { ProyectosController } from './proyectos.controller';
import { ProyectosRepository } from './proyectos.repository';
import { TareasProyectoService } from './tareas-proyecto.service';
import { TareasProyectoController } from './tareas-proyecto.controller';
import { ClientesModule } from '../clientes/clientes.module';
import { NominaModule } from '../nomina/nomina.module';
import { ConfiguracionesModule } from '../configuraciones/configuraciones.module';

/**
 * Plugin de Proyectos (Fase 1) — ver plugins/proyectos/README.md. Gateado
 * por módulo (`@RequiereModulo('proyectos')` en ambos controllers) igual
 * que Inmobiliaria/Tienda Online: el tenant lo recibe vía su Plan o un
 * `TenantModuloOverride` puntual desde /plataforma/tenants, nunca lo
 * activa el propio tenant.
 */
@Module({
  imports: [ClientesModule, NominaModule, ConfiguracionesModule],
  controllers: [ProyectosController, TareasProyectoController],
  providers: [ProyectosService, ProyectosRepository, TareasProyectoService],
  exports: [ProyectosRepository],
})
export class ProyectosModule {}
