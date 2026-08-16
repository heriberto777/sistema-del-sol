import { Module } from '@nestjs/common';
import { GastosMenoresService } from './gastos-menores.service';
import { GastosMenoresController } from './gastos-menores.controller';
import { GastosMenoresRepository } from './gastos-menores.repository';

@Module({
  controllers: [GastosMenoresController],
  providers: [GastosMenoresService, GastosMenoresRepository],
  exports: [GastosMenoresService],
})
export class GastosMenoresModule {}
