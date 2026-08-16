import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PosService } from './pos.service';
import { AbrirTurnoDto } from './dto/abrir-turno.dto';
import { CerrarTurnoDto } from './dto/cerrar-turno.dto';
import { CrearMovimientoCajaDto } from './dto/crear-movimiento-caja.dto';
import { RegistrarVentaPosDto } from './dto/registrar-venta.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('pos')
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('turnos')
  @Permissions('pos.editar')
  abrirTurno(@Body() dto: AbrirTurnoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.posService.abrirTurno(dto, user.tenantId, user.userId);
  }

  @Get('turnos')
  @Permissions('pos.ver')
  listarTurnos(@Query() query: ListadoQueryDto) {
    return this.posService.listar(query);
  }

  @Get('turnos/:id')
  @Permissions('pos.ver')
  buscarTurno(@Param('id') id: string) {
    return this.posService.buscarPorId(id);
  }

  @Post('turnos/:id/movimientos')
  @Permissions('pos.editar')
  registrarMovimiento(@Param('id') id: string, @Body() dto: CrearMovimientoCajaDto) {
    return this.posService.registrarMovimiento(id, dto);
  }

  @Post('turnos/:id/cerrar')
  @Permissions('pos.editar')
  cerrarTurno(@Param('id') id: string, @Body() dto: CerrarTurnoDto) {
    return this.posService.cerrarTurno(id, dto);
  }

  @Post('ventas')
  @Permissions('pos.editar')
  registrarVenta(@Body() dto: RegistrarVentaPosDto, @CurrentUser() user: JwtPayloadUser) {
    return this.posService.registrarVenta(dto, user.tenantId, user.userId);
  }
}
