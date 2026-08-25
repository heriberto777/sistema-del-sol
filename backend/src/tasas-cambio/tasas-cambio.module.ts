import { Module } from '@nestjs/common';
import { TasasCambioService } from './tasas-cambio.service';
import { TasasCambioController } from './tasas-cambio.controller';
import { TasasCambioRepository } from './tasas-cambio.repository';

@Module({
  controllers: [TasasCambioController],
  providers: [TasasCambioService, TasasCambioRepository],
  exports: [TasasCambioService],
})
export class TasasCambioModule {}
