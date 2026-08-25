import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TipoCorrelativo } from '@prisma/client';
import { CorrelativosService } from './correlativos.service';
import { ActualizarCorrelativoDto } from './dto/actualizar-correlativo.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('correlativos')
@Controller('admin/correlativos')
export class CorrelativosController {
  constructor(private readonly correlativosService: CorrelativosService) {}

  @Get()
  @Permissions('admin.configuracion')
  listar() {
    return this.correlativosService.listar();
  }

  @Patch(':tipo')
  @Permissions('admin.configuracion')
  actualizar(@Param('tipo') tipo: TipoCorrelativo, @Body() dto: ActualizarCorrelativoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.correlativosService.actualizar(user.tenantId, tipo, dto);
  }

  // Sin @Permissions a propósito — lo consume el botón "Asignar" desde los
  // formularios de Producto/CuentaContable, cuyos propios permisos de
  // módulo ya gatean la creación del recurso; consumir un correlativo por
  // sí solo no es una operación sensible.
  @Post(':tipo/siguiente')
  async siguiente(@Param('tipo') tipo: TipoCorrelativo, @CurrentUser() user: JwtPayloadUser) {
    const valor = await this.correlativosService.siguiente(user.tenantId, tipo);
    return { valor };
  }
}
