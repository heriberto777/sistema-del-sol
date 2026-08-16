import { Module } from '@nestjs/common';
import { ReportesFiscalesService } from './reportes-fiscales.service';
import { ReportesFiscalesController } from './reportes-fiscales.controller';
import { ReportesFiscalesRepository } from './reportes-fiscales.repository';

@Module({
  controllers: [ReportesFiscalesController],
  providers: [ReportesFiscalesService, ReportesFiscalesRepository],
})
export class ReportesFiscalesModule {}
