import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { PosRepository } from './pos.repository';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { ConfiguracionesModule } from '../configuraciones/configuraciones.module';
import { FormasPagoModule } from '../formas-pago/formas-pago.module';
import { NominaModule } from '../nomina/nomina.module';
import { VariantesModule } from '../variantes/variantes.module';
import { InventarioModule } from '../inventario/inventario.module';
import { AuthModule } from '../auth/auth.module';
import { AutorizacionesModule } from '../autorizaciones/autorizaciones.module';
import { CajasModule } from '../cajas/cajas.module';

@Module({
  imports: [
    FacturacionModule,
    ConfiguracionesModule,
    FormasPagoModule,
    NominaModule,
    VariantesModule,
    InventarioModule,
    AuthModule,
    AutorizacionesModule,
    CajasModule,
  ],
  controllers: [PosController],
  providers: [PosService, PosRepository],
})
export class PosModule {}
