import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OportunidadesService } from './oportunidades.service';
import { CrearOportunidadDto } from './dto/crear-oportunidad.dto';
import { CambiarEtapaOportunidadDto } from './dto/cambiar-etapa-oportunidad.dto';
import { CerrarOportunidadDto } from './dto/cerrar-oportunidad.dto';
import { ListarOportunidadesQueryDto } from './dto/listar-oportunidades-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('crm')
@RequiereModulo('crm')
@Controller('crm/oportunidades')
export class OportunidadesController {
  constructor(private readonly oportunidadesService: OportunidadesService) {}

  @Post()
  @Permissions('crm.oportunidades.crear')
  crear(@Body() dto: CrearOportunidadDto, @CurrentUser() user: JwtPayloadUser) {
    return this.oportunidadesService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('crm.ver')
  listar(@Query() query: ListarOportunidadesQueryDto) {
    return this.oportunidadesService.listar(query);
  }

  // Ruta estática ANTES de ':id' — si no, ':id' la captura primero (mismo gotcha que CotizacionesController.resumenConversion).
  @Get('pipeline')
  @Permissions('crm.ver')
  obtenerPipeline() {
    return this.oportunidadesService.obtenerPipeline();
  }

  @Get(':id')
  @Permissions('crm.ver')
  buscarPorId(@Param('id') id: string) {
    return this.oportunidadesService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('crm.oportunidades.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearOportunidadDto>) {
    return this.oportunidadesService.actualizar(id, dto);
  }

  @Patch(':id/etapa')
  @Permissions('crm.oportunidades.editar')
  cambiarEtapa(@Param('id') id: string, @Body() dto: CambiarEtapaOportunidadDto) {
    return this.oportunidadesService.cambiarEtapa(id, dto);
  }

  @Patch(':id/cerrar')
  @Permissions('crm.oportunidades.editar')
  cerrar(@Param('id') id: string, @Body() dto: CerrarOportunidadDto) {
    return this.oportunidadesService.cerrar(id, dto);
  }

  @Delete(':id')
  @Permissions('crm.oportunidades.eliminar')
  eliminar(@Param('id') id: string) {
    return this.oportunidadesService.eliminar(id);
  }
}
