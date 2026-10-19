import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UnidadesMedidaService } from './unidades-medida.service';
import { CrearUnidadMedidaDto } from './dto/crear-unidad-medida.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('unidades-medida')
@Controller('unidades-medida')
export class UnidadesMedidaController {
  constructor(private readonly unidadesMedidaService: UnidadesMedidaService) {}

  @Post()
  @Permissions('admin.configuracion')
  crear(@Body() dto: CrearUnidadMedidaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.unidadesMedidaService.crear(dto, user.tenantId);
  }

  // Sin @Permissions a propósito: lista de referencia que necesita cualquiera
  // que cree/edite un Producto o una línea de Compra — no solo quien
  // administra el catálogo (mismo criterio que FormasPagoController.listar).
  @Get()
  listar(@Query('activa') activa?: string) {
    return this.unidadesMedidaService.listar(activa === 'true');
  }

  @Patch(':id')
  @Permissions('admin.configuracion')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearUnidadMedidaDto>) {
    return this.unidadesMedidaService.actualizar(id, dto);
  }
}
