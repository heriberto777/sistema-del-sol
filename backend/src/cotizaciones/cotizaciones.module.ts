import { Module } from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesRepository } from './cotizaciones.repository';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { ClientesModule } from '../clientes/clientes.module';

@Module({
  imports: [FacturacionModule, ClientesModule],
  controllers: [CotizacionesController],
  providers: [CotizacionesService, CotizacionesRepository],
})
export class CotizacionesModule {}
