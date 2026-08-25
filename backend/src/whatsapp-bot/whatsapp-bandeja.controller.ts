import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WhatsappBandejaService } from './whatsapp-bandeja.service';
import { ResponderWhatsappDto } from './dto/responder-whatsapp.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/** Bandeja de escalación a humano del bot de WhatsApp (ítem H-2b) — sin chat en vivo, mismo permiso que el resto de Admin → Integraciones. */
@ApiBearerAuth()
@ApiTags('whatsapp-bandeja')
@Controller('admin/whatsapp-bandeja')
export class WhatsappBandejaController {
  constructor(private readonly whatsappBandejaService: WhatsappBandejaService) {}

  @Get()
  @Permissions('admin.configuracion')
  listar() {
    return this.whatsappBandejaService.listarPendientes();
  }

  @Post(':telefono/responder')
  @Permissions('admin.configuracion')
  responder(@Param('telefono') telefono: string, @Body() dto: ResponderWhatsappDto, @CurrentUser() user: JwtPayloadUser) {
    return this.whatsappBandejaService.responder(user.tenantId, telefono, dto.contenido);
  }

  @Patch(':telefono/atendido')
  @Permissions('admin.configuracion')
  marcarAtendido(@Param('telefono') telefono: string) {
    return this.whatsappBandejaService.marcarAtendido(telefono);
  }
}
