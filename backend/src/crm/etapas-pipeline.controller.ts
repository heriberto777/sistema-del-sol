import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EtapasPipelineService } from './etapas-pipeline.service';
import { CrearEtapaPipelineDto } from './dto/crear-etapa-pipeline.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('crm')
@RequiereModulo('crm')
@Controller('crm/etapas-pipeline')
export class EtapasPipelineController {
  constructor(private readonly etapasPipelineService: EtapasPipelineService) {}

  @Post()
  @Permissions('crm.pipeline.configurar')
  crear(@Body() dto: CrearEtapaPipelineDto, @CurrentUser() user: JwtPayloadUser) {
    return this.etapasPipelineService.crear(dto, user.tenantId);
  }

  // Sin permiso más restrictivo que crm.ver a propósito — cualquiera que
  // necesite elegir una etapa (formulario de Oportunidad, Kanban) la
  // tiene, no solo quien administra el pipeline.
  @Get()
  @Permissions('crm.ver')
  listar(@CurrentUser() user: JwtPayloadUser) {
    return this.etapasPipelineService.obtenerOSembrar(user.tenantId);
  }

  @Patch(':id')
  @Permissions('crm.pipeline.configurar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearEtapaPipelineDto>) {
    return this.etapasPipelineService.actualizar(id, dto);
  }

  @Delete(':id')
  @Permissions('crm.pipeline.configurar')
  eliminar(@Param('id') id: string) {
    return this.etapasPipelineService.eliminar(id);
  }
}
