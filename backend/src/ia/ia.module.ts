import { Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { IaClientService } from './ia-client.service';
import { IaController } from './ia.controller';
import { ReportesModule } from '../reportes/reportes.module';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';

@Module({
  imports: [ReportesModule, ContabilidadModule],
  controllers: [IaController],
  providers: [IaService, IaClientService],
})
export class IaModule {}
