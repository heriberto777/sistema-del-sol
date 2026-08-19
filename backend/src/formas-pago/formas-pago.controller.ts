import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FormasPagoService } from './formas-pago.service';
import { CrearFormaPagoDto } from './dto/crear-forma-pago.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('formas-pago')
@Controller('formas-pago')
export class FormasPagoController {
  constructor(private readonly formasPagoService: FormasPagoService) {}

  @Post()
  @Permissions('admin.configuracion')
  crear(@Body() dto: CrearFormaPagoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.formasPagoService.crear(dto, user.tenantId);
  }

  // Sin @Permissions a propósito: lista de referencia (nombres de forma de
  // pago) que necesita cualquiera que registre un cobro/venta — POS,
  // Cobranza, Compras — no solo quien administra el catálogo.
  @Get()
  listar(@Query('activa') activa?: string) {
    return this.formasPagoService.listar(activa === 'true');
  }

  @Patch(':id')
  @Permissions('admin.configuracion')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearFormaPagoDto>, @CurrentUser() user: JwtPayloadUser) {
    return this.formasPagoService.actualizar(id, dto, user.tenantId);
  }
}
