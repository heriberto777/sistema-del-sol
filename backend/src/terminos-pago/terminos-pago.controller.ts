import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TerminosPagoService } from './terminos-pago.service';
import { CrearTerminoPagoDto } from './dto/crear-termino-pago.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('terminos-pago')
@Controller('terminos-pago')
export class TerminosPagoController {
  constructor(private readonly terminosPagoService: TerminosPagoService) {}

  @Post()
  @Permissions('cuentasporcobrar.terminospago.editar')
  crear(@Body() dto: CrearTerminoPagoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.terminosPagoService.crear(dto, user.tenantId);
  }

  // Permiso de ver (no el de editar) a propósito — mismo criterio que
  // CategoriasClienteController.listar: cualquiera que necesite elegir un
  // término de pago (formulario de Cliente/Proveedor) debe poder listarlo,
  // no solo quien administra el catálogo.
  @Get()
  @Permissions('cuentasporcobrar.terminospago.ver')
  listar(@Query('activo') activo?: string) {
    return this.terminosPagoService.listar(activo === 'true');
  }

  @Get(':id')
  @Permissions('cuentasporcobrar.terminospago.ver')
  buscarPorId(@Param('id') id: string) {
    return this.terminosPagoService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('cuentasporcobrar.terminospago.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearTerminoPagoDto>) {
    return this.terminosPagoService.actualizar(id, dto);
  }
}
