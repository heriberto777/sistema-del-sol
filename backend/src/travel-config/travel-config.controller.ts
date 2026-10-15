import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TravelConfigService } from './travel-config.service';
import { ActualizarTravelConfigDto } from './dto/actualizar-travel-config.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/** Sin `@RequiereModulo('travel')` a propósito — mismo criterio que WhatsappConfigController: configurar la cuenta es un paso de Administración, no debería bloquearse si el módulo todavía no está activo. */
@ApiBearerAuth()
@ApiTags('travel-config')
@Controller('admin/travel-config')
export class TravelConfigController {
  constructor(private readonly travelConfigService: TravelConfigService) {}

  @Get()
  @Permissions('admin.configuracion')
  obtener(@CurrentUser() user: JwtPayloadUser) {
    return this.travelConfigService.obtener(user.tenantId);
  }

  @Patch()
  @Permissions('admin.configuracion')
  actualizar(@Body() dto: ActualizarTravelConfigDto, @CurrentUser() user: JwtPayloadUser) {
    return this.travelConfigService.actualizar(user.tenantId, dto);
  }
}
