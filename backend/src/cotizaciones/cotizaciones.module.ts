import { Module } from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesRepository } from './cotizaciones.repository';
import { FacturacionModule } from '../facturacion/facturacion.module';

@Module({
  imports: [FacturacionModule],
  controllers: [CotizacionesController],
  providers: [CotizacionesService, CotizacionesRepository],
})
export class CotizacionesModule {}
