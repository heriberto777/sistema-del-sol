import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActividadesCrmService } from './actividades-crm.service';
import { CrearActividadCrmDto } from './dto/crear-actividad-crm.dto';
import { ListarActividadesCrmQueryDto } from './dto/listar-actividades-crm-query.dto';
import { MarcarCompletadaActividadDto } from './dto/marcar-completada-actividad.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('crm')
@RequiereModulo('crm')
@Controller('crm/actividades')
export class ActividadesCrmController {
  constructor(private readonly actividadesCrmService: ActividadesCrmService) {}

  @Post()
  @Permissions('crm.ver')
  crear(@Body() dto: CrearActividadCrmDto, @CurrentUser() user: JwtPayloadUser) {
    return this.actividadesCrmService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('crm.ver')
  listar(@Query() query: ListarActividadesCrmQueryDto) {
    return this.actividadesCrmService.listar(query);
  }

  @Patch(':id/completada')
  @Permissions('crm.ver')
  marcarCompletada(@Param('id') id: string, @Body() dto: MarcarCompletadaActividadDto) {
    return this.actividadesCrmService.marcarCompletada(id, dto.completada);
  }

  @Delete(':id')
  @Permissions('crm.ver')
  eliminar(@Param('id') id: string) {
    return this.actividadesCrmService.eliminar(id);
  }
}
