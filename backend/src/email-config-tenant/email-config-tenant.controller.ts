import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmailConfigTenantService } from './email-config-tenant.service';
import { ActualizarEmailConfigTenantDto } from './dto/actualizar-email-config-tenant.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('email-config')
@Controller('admin/email-config')
export class EmailConfigTenantController {
  constructor(private readonly emailConfigTenantService: EmailConfigTenantService) {}

  @Get()
  @Permissions('admin.configuracion')
  obtener(@CurrentUser() user: JwtPayloadUser) {
    return this.emailConfigTenantService.obtener(user.tenantId);
  }

  @Patch()
  @Permissions('admin.configuracion')
  actualizar(@Body() dto: ActualizarEmailConfigTenantDto, @CurrentUser() user: JwtPayloadUser) {
    return this.emailConfigTenantService.actualizar(user.tenantId, dto);
  }
}
