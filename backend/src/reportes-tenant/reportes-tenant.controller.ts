import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportesTenantService } from './reportes-tenant.service';
import { CrearReporteTenantDto } from './dto/crear-reporte-tenant.dto';
import { CrearMensajeReporteTenantDto } from './dto/crear-mensaje-reporte-tenant.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/**
 * "Reportar un problema" — sin `@Permissions`, a propósito: cualquier
 * usuario autenticado del tenant puede reportar, mismo criterio que
 * GRUPO_MI_ESPACIO en el frontend (utilidad personal). El lado
 * plataforma (ver/responder) vive en `platform-reportes-tenant.controller.ts`.
 */
@ApiBearerAuth()
@ApiTags('reportes-tenant')
@Controller('reportes-tenant')
export class ReportesTenantController {
  constructor(private readonly reportesTenantService: ReportesTenantService) {}

  @Post()
  crear(@Body() dto: CrearReporteTenantDto, @CurrentUser() user: JwtPayloadUser) {
    return this.reportesTenantService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  listar(@Query() query: ListadoQueryDto) {
    return this.reportesTenantService.listarPropios(query);
  }

  @Get(':id/mensajes')
  listarMensajes(@Param('id') id: string) {
    return this.reportesTenantService.listarMensajes(id);
  }

  @Post(':id/mensajes')
  agregarMensaje(@Param('id') id: string, @Body() dto: CrearMensajeReporteTenantDto, @CurrentUser() user: JwtPayloadUser) {
    return this.reportesTenantService.agregarMensaje(id, dto, user.userId);
  }
}
