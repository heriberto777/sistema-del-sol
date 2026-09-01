import { Module } from '@nestjs/common';
import { PlanesService } from './planes.service';
import { PlanesController } from './planes.controller';
import { PlanesRepository } from './planes.repository';
import { TenantModulosController } from './tenant-modulos.controller';
import { TenantModulosService } from './tenant-modulos.service';

@Module({
  controllers: [PlanesController, TenantModulosController],
  providers: [PlanesService, PlanesRepository, TenantModulosService],
  // Ítem "dashboard de plataforma" — PlatformDashboardModule necesita el
  // listado de planes para armar "tenants por plan".
  exports: [PlanesService],
})
export class PlanesModule {}
