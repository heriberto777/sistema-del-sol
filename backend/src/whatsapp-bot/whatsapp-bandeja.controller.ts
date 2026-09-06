import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WhatsappBandejaService } from './whatsapp-bandeja.service';
import { ResponderWhatsappDto } from './dto/responder-whatsapp.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/**
 * Bandeja de escalación a humano del bot de WhatsApp (ítem H-2b) — sin chat
 * en vivo. Permiso `whatsapp.bandeja.usar`, a propósito DISTINTO de
 * `admin.configuracion` (ese sigue gateando solo la config del bot): el
 * drawer global vive en Facturación/POS para que Cajero/Vendedor puedan
 * responder sin pasar por Administración (ver roles-base.ts).
 */
@ApiBearerAuth()
@ApiTags('whatsapp-bandeja')
@Controller('admin/whatsapp-bandeja')
export class WhatsappBandejaController {
  constructor(private readonly whatsappBandejaService: WhatsappBandejaService) {}

  @Get()
  @Permissions('whatsapp.bandeja.usar')
  listar() {
    return this.whatsappBandejaService.listarPendientes();
  }

  @Get(':telefono/conversacion')
  @Permissions('whatsapp.bandeja.usar')
  conversacion(@Param('telefono') telefono: string) {
    return this.whatsappBandejaService.obtenerConversacion(telefono);
  }

  @Post(':telefono/responder')
  @Permissions('whatsapp.bandeja.usar')
  responder(@Param('telefono') telefono: string, @Body() dto: ResponderWhatsappDto, @CurrentUser() user: JwtPayloadUser) {
    return this.whatsappBandejaService.responder(user.tenantId, telefono, dto.contenido, dto.productoId);
  }

  @Patch(':telefono/atendido')
  @Permissions('whatsapp.bandeja.usar')
  marcarAtendido(@Param('telefono') telefono: string) {
    return this.whatsappBandejaService.marcarAtendido(telefono);
  }
}
