import { Module } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagosRepository } from './pagos.repository';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';
import { FormasPagoModule } from '../formas-pago/formas-pago.module';
import { CuentasPorPagarModule } from '../cuentas-por-pagar/cuentas-por-pagar.module';

@Module({
  imports: [ContabilidadModule, FormasPagoModule, CuentasPorPagarModule],
  providers: [PagosService, PagosRepository],
  exports: [PagosService],
})
export class PagosModule {}
