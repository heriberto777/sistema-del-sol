import { Module } from '@nestjs/common';
import { TerminosPagoService } from './terminos-pago.service';
import { TerminosPagoController } from './terminos-pago.controller';
import { TerminosPagoRepository } from './terminos-pago.repository';

@Module({
  controllers: [TerminosPagoController],
  providers: [TerminosPagoService, TerminosPagoRepository],
  exports: [TerminosPagoService, TerminosPagoRepository],
})
export class TerminosPagoModule {}
