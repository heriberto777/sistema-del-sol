import { Module } from '@nestjs/common';
import { TareasPersonalesController } from './tareas-personales.controller';
import { TareasPersonalesService } from './tareas-personales.service';
import { TareasPersonalesRepository } from './tareas-personales.repository';

/**
 * "Mis Tareas" — sin manifiesto en plugins/ y sin `@RequiereModulo`:
 * a diferencia de Inmobiliaria/Proyectos/Ecommerce (verticales de
 * negocio vendibles por plan), esto es productividad personal, siempre
 * disponible para cualquier usuario — mismo criterio que Contabilidad/
 * Contactos (ver MODULOS_BASE en roles-base.ts).
 */
@Module({
  controllers: [TareasPersonalesController],
  providers: [TareasPersonalesService, TareasPersonalesRepository],
})
export class TareasPersonalesModule {}
