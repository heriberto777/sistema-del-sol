import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { CrearLeadDto } from './dto/crear-lead.dto';
import { CambiarEstadoLeadDto } from './dto/cambiar-estado-lead.dto';
import { ListarLeadsQueryDto } from './dto/listar-leads-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('crm')
@RequiereModulo('crm')
@Controller('crm/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @Permissions('crm.leads.crear')
  crear(@Body() dto: CrearLeadDto, @CurrentUser() user: JwtPayloadUser) {
    return this.leadsService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('crm.ver')
  listar(@Query() query: ListarLeadsQueryDto) {
    return this.leadsService.listar(query);
  }

  @Get(':id')
  @Permissions('crm.ver')
  buscarPorId(@Param('id') id: string) {
    return this.leadsService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('crm.leads.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearLeadDto>) {
    return this.leadsService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @Permissions('crm.leads.editar')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoLeadDto) {
    return this.leadsService.cambiarEstado(id, dto);
  }
}
