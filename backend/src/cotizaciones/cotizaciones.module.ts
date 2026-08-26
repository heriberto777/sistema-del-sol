import { Module } from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesRepository } from './cotizaciones.repository';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { ClientesModule } from '../clientes/clientes.module';
import { VariantesModule } from '../variantes/variantes.module';
import { OfertasModule } from '../ofertas/ofertas.module';
import { CorrelativosModule } from '../correlativos/correlativos.module';
import { ConfiguracionesModule } from '../configuraciones/configuraciones.module';

@Module({
  imports: [FacturacionModule, ClientesModule, VariantesModule, OfertasModule, CorrelativosModule, ConfiguracionesModule],
  controllers: [CotizacionesController],
  providers: [CotizacionesService, CotizacionesRepository],
})
export class CotizacionesModule {}
