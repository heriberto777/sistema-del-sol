import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PasarelaCobroConfigService } from './pasarela-cobro-config.service';
import { ActualizarPasarelaConfigDto } from './dto/actualizar-pasarela-config.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('pasarela-cobro')
@Controller('admin/pasarela-cobro')
export class PasarelaCobroConfigController {
  constructor(private readonly pasarelaCobroConfigService: PasarelaCobroConfigService) {}

  @Get()
  @Permissions('admin.configuracion')
  obtener(@CurrentUser() user: JwtPayloadUser) {
    return this.pasarelaCobroConfigService.obtener(user.tenantId);
  }

  @Patch()
  @Permissions('admin.configuracion')
  actualizar(@Body() dto: ActualizarPasarelaConfigDto, @CurrentUser() user: JwtPayloadUser) {
    return this.pasarelaCobroConfigService.actualizar(user.tenantId, dto);
  }
}
