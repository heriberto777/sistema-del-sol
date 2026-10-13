import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClienteTimelineService } from './cliente-timeline.service';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';

@ApiBearerAuth()
@ApiTags('crm')
@RequiereModulo('crm')
@Controller('crm/clientes')
export class ClienteTimelineController {
  constructor(private readonly clienteTimelineService: ClienteTimelineService) {}

  @Get(':clienteId/timeline')
  @Permissions('crm.ver')
  obtener(@Param('clienteId') clienteId: string) {
    return this.clienteTimelineService.obtener(clienteId);
  }
}
