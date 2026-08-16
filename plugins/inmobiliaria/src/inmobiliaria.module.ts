import { Module } from '@nestjs/common';
import { InmobiliariaController } from './inmobiliaria.controller';

@Module({
  controllers: [InmobiliariaController],
})
export class InmobiliariaModule {}
