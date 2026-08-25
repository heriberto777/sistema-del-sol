import { Module } from '@nestjs/common';
import { WhatsappConfigController } from './whatsapp-config.controller';
import { WhatsappConfigService } from './whatsapp-config.service';
import { WhatsappConfigRepository } from './whatsapp-config.repository';

@Module({
  controllers: [WhatsappConfigController],
  providers: [WhatsappConfigService, WhatsappConfigRepository],
  exports: [WhatsappConfigRepository],
})
export class WhatsappConfigModule {}
