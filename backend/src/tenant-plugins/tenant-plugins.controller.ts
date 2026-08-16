import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantPluginsService } from './tenant-plugins.service';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('admin-plugins')
@Controller('admin/plugins')
export class TenantPluginsController {
  constructor(private readonly tenantPluginsService: TenantPluginsService) {}

  @Get()
  @Permissions('admin.plugins')
  listar() {
    return this.tenantPluginsService.listar();
  }

  @Post(':pluginKey/activar')
  @Permissions('admin.plugins')
  activar(@Param('pluginKey') pluginKey: string, @CurrentUser() user: JwtPayloadUser) {
    return this.tenantPluginsService.activar(pluginKey, user.tenantId);
  }

  @Post(':pluginKey/desactivar')
  @Permissions('admin.plugins')
  desactivar(@Param('pluginKey') pluginKey: string, @CurrentUser() user: JwtPayloadUser) {
    return this.tenantPluginsService.desactivar(pluginKey, user.tenantId);
  }
}
