import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WhatsappConfigService } from './whatsapp-config.service';
import { ActualizarWhatsappConfigDto } from './dto/actualizar-whatsapp-config.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('whatsapp-config')
@Controller('admin/whatsapp-config')
export class WhatsappConfigController {
  constructor(private readonly whatsappConfigService: WhatsappConfigService) {}

  @Get()
  @Permissions('admin.configuracion')
  obtener(@CurrentUser() user: JwtPayloadUser) {
    return this.whatsappConfigService.obtener(user.tenantId);
  }

  @Patch()
  @Permissions('admin.configuracion')
  actualizar(@Body() dto: ActualizarWhatsappConfigDto, @CurrentUser() user: JwtPayloadUser) {
    return this.whatsappConfigService.actualizar(user.tenantId, dto);
  }

  @Get('modelos')
  @Permissions('admin.configuracion')
  listarModelos(@Query('proveedor') proveedor: string, @CurrentUser() user: JwtPayloadUser) {
    return this.whatsappConfigService.listarModelos(user.tenantId, proveedor).then((modelos) => ({ modelos }));
  }

  @Post('sugerir-comportamiento')
  @Permissions('admin.configuracion')
  sugerirComportamiento(@CurrentUser() user: JwtPayloadUser) {
    return this.whatsappConfigService.sugerirComportamiento(user.tenantId);
  }
}
