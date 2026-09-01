import { Module } from '@nestjs/common';
import { AlanubeAdapter } from './alanube.adapter';
import { EmisionECfService } from './emision-ecf.service';
import { EmisionECfEventosService } from './emision-ecf-eventos.service';
import { AlanubeWebhookController } from './alanube-webhook.controller';

@Module({
  controllers: [AlanubeWebhookController],
  providers: [AlanubeAdapter, EmisionECfService, EmisionECfEventosService],
  exports: [AlanubeAdapter, EmisionECfService],
})
export class EmisionECfModule {}
