import { Module } from '@nestjs/common';
import { FormasPagoService } from './formas-pago.service';
import { FormasPagoController } from './formas-pago.controller';
import { FormasPagoRepository } from './formas-pago.repository';

@Module({
  controllers: [FormasPagoController],
  providers: [FormasPagoService, FormasPagoRepository],
  exports: [FormasPagoService, FormasPagoRepository],
})
export class FormasPagoModule {}
