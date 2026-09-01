import { Module } from '@nestjs/common';
import { PlataformaConfigModule } from '../plataforma-config/plataforma-config.module';
import { AlanubeAdapter } from './alanube.adapter';
import { EmisionECfService } from './emision-ecf.service';
import { EmisionECfEventosService } from './emision-ecf-eventos.service';
import { AlanubeWebhookController } from './alanube-webhook.controller';

@Module({
  imports: [PlataformaConfigModule],
  controllers: [AlanubeWebhookController],
  providers: [AlanubeAdapter, EmisionECfService, EmisionECfEventosService],
  exports: [AlanubeAdapter, EmisionECfService],
})
export class EmisionECfModule {}
