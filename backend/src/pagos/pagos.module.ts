import { Module } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagosRepository } from './pagos.repository';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';
import { FormasPagoModule } from '../formas-pago/formas-pago.module';

@Module({
  imports: [ContabilidadModule, FormasPagoModule],
  providers: [PagosService, PagosRepository],
  exports: [PagosService],
})
export class PagosModule {}
