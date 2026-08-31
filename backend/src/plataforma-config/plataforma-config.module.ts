import { Module } from '@nestjs/common';
import { PlataformaConfigController } from './plataforma-config.controller';
import { PlataformaConfigService } from './plataforma-config.service';
import { PlataformaConfigRepository } from './plataforma-config.repository';
import { PlataformaWebhookChannel } from './plataforma-webhook.channel';

@Module({
  controllers: [PlataformaConfigController],
  providers: [PlataformaConfigService, PlataformaConfigRepository, PlataformaWebhookChannel],
  exports: [PlataformaConfigRepository, PlataformaWebhookChannel],
})
export class PlataformaConfigModule {}
