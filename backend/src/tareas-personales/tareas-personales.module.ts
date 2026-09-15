import { Module } from '@nestjs/common';
import { TareasPersonalesController } from './tareas-personales.controller';
import { TareasPersonalesService } from './tareas-personales.service';
import { TareasPersonalesRepository } from './tareas-personales.repository';
import { TareasPersonalesCronService } from './tareas-personales-cron.service';

/**
 * "Mis Tareas" — sin manifiesto en plugins/ (vive en src/ como un módulo
 * más), pero SÍ activable por Plan/TenantModuloOverride (clave
 * 'mistareas' en MODULOS_BASE, tenants/modulos-base.ts) desde que sumó
 * categorías de incentivo con envío de reportes — dejó de ser
 * "siempre-on" como Contabilidad/Contactos.
 */
@Module({
  controllers: [TareasPersonalesController],
  providers: [TareasPersonalesService, TareasPersonalesRepository, TareasPersonalesCronService],
})
export class TareasPersonalesModule {}
