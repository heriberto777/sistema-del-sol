import { Module } from '@nestjs/common';
import { PlatformDashboardController } from './platform-dashboard.controller';
import { PlatformDashboardService } from './platform-dashboard.service';
import { TenantsModule } from '../tenants/tenants.module';
import { PlanesModule } from '../planes/planes.module';
import { FacturacionPlataformaModule } from '../facturacion-plataforma/facturacion-plataforma.module';

@Module({
  imports: [TenantsModule, PlanesModule, FacturacionPlataformaModule],
  controllers: [PlatformDashboardController],
  providers: [PlatformDashboardService],
})
export class PlatformDashboardModule {}
