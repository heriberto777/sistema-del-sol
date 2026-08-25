import { Module } from '@nestjs/common';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappMensajesRepository } from './whatsapp-mensajes.repository';
import { WhatsappMensajesAdminRepository } from './whatsapp-mensajes-admin.repository';
import { WhatsappBandejaController } from './whatsapp-bandeja.controller';
import { WhatsappBandejaService } from './whatsapp-bandeja.service';
import { IaModule } from '../ia/ia.module';
import { WhatsappConfigModule } from '../whatsapp-config/whatsapp-config.module';

@Module({
  imports: [IaModule, WhatsappConfigModule],
  controllers: [WhatsappWebhookController, WhatsappBandejaController],
  providers: [WhatsappBotService, WhatsappMensajesRepository, WhatsappMensajesAdminRepository, WhatsappBandejaService],
})
export class WhatsappBotModule {}
