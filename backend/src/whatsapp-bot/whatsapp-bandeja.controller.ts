import { Body, Controller, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
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

  /** Inbox completo de la página "Mensajes" — permiso DISTINTO (más restringido) que el resto de esta bandeja, ver roles-base.ts. */
  @Get('conversaciones')
  @Permissions('whatsapp.mensajes.ver')
  conversaciones() {
    return this.whatsappBandejaService.listarConversaciones();
  }

  /**
   * Compartido por el drawer (`whatsapp.bandeja.usar`, todos los
   * atendedores) y la página "Mensajes" (`whatsapp.mensajes.ver`, solo
   * Gerente/Admin Total) — `@Permissions` exige TODOS los permisos que le
   * pasás (AND), no "cualquiera de estos" (OR), así que ninguno de los dos
   * alcanza acá solo: se valida a mano contra los DOS.
   */
  @Get(':telefono/conversacion')
  conversacion(@Param('telefono') telefono: string, @CurrentUser() user: JwtPayloadUser) {
    const permisos = new Set(user.permisos);
    if (!permisos.has('whatsapp.bandeja.usar') && !permisos.has('whatsapp.mensajes.ver')) {
      throw new ForbiddenException('Requiere el/los permiso(s): whatsapp.bandeja.usar, whatsapp.mensajes.ver');
    }
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
