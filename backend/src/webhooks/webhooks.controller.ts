import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CrearWebhookDto } from './dto/crear-webhook.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @Permissions('admin.configuracion')
  crear(@Body() dto: CrearWebhookDto, @CurrentUser() user: JwtPayloadUser) {
    return this.webhooksService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('admin.configuracion')
  listar() {
    return this.webhooksService.listar();
  }

  @Delete(':id')
  @Permissions('admin.configuracion')
  eliminar(@Param('id') id: string) {
    return this.webhooksService.eliminar(id);
  }

  @Get(':id/deliveries')
  @Permissions('admin.configuracion')
  listarEntregas(@Param('id') id: string, @Query() query: ListadoQueryDto) {
    return this.webhooksService.listarEntregas(id, query);
  }
}
