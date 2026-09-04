import { Module } from '@nestjs/common';
import { PlataformaConfigController } from './plataforma-config.controller';
import { PlataformaConfigPublicaController } from './plataforma-config-publica.controller';
import { PlataformaConfigService } from './plataforma-config.service';
import { PlataformaConfigRepository } from './plataforma-config.repository';
import { PlataformaWebhookChannel } from './plataforma-webhook.channel';
import { NpmClientService } from './npm/npm-client.service';

@Module({
  controllers: [PlataformaConfigController, PlataformaConfigPublicaController],
  providers: [PlataformaConfigService, PlataformaConfigRepository, PlataformaWebhookChannel, NpmClientService],
  exports: [PlataformaConfigRepository, PlataformaWebhookChannel, NpmClientService],
})
export class PlataformaConfigModule {}
