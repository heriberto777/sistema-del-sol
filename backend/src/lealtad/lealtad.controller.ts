import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LealtadService } from './lealtad.service';
import { ActualizarConfiguracionLealtadDto } from './dto/actualizar-configuracion-lealtad.dto';
import { AjusteLealtadDto } from './dto/ajuste-lealtad.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/** Ítem A-3 — programa de lealtad/puntos, apagado por defecto. */
@ApiBearerAuth()
@ApiTags('lealtad')
@Controller('lealtad')
export class LealtadController {
  constructor(private readonly lealtadService: LealtadService) {}

  @Get('configuracion')
  @Permissions('lealtad.ver')
  obtenerConfiguracion() {
    return this.lealtadService.obtenerConfiguracion();
  }

  @Patch('configuracion')
  @Permissions('lealtad.editar')
  actualizarConfiguracion(@Body() dto: ActualizarConfiguracionLealtadDto, @CurrentUser() user: JwtPayloadUser) {
    return this.lealtadService.actualizarConfiguracion(user.tenantId, dto);
  }

  @Get('clientes/:clienteId/historial')
  @Permissions('lealtad.ver')
  historialCliente(@Param('clienteId') clienteId: string) {
    return this.lealtadService.historialCliente(clienteId);
  }

  @Post('ajuste')
  @Permissions('lealtad.editar')
  ajusteManual(@Body() dto: AjusteLealtadDto, @CurrentUser() user: JwtPayloadUser) {
    return this.lealtadService.ajusteManual(user.tenantId, dto.clienteId, dto.puntos, dto.motivo);
  }
}
