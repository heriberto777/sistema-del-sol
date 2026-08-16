import { Module } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagosRepository } from './pagos.repository';

@Module({
  providers: [PagosService, PagosRepository],
  exports: [PagosService],
})
export class PagosModule {}
