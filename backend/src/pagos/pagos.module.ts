import { Module } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagosRepository } from './pagos.repository';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';

@Module({
  imports: [ContabilidadModule],
  providers: [PagosService, PagosRepository],
  exports: [PagosService],
})
export class PagosModule {}
