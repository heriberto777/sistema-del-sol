import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PosService } from './pos.service';
import { AbrirTurnoDto } from './dto/abrir-turno.dto';
import { CerrarTurnoDto } from './dto/cerrar-turno.dto';
import { CrearMovimientoCajaDto } from './dto/crear-movimiento-caja.dto';
import { RegistrarVentaPosDto } from './dto/registrar-venta.dto';
import { ListarTurnosQueryDto } from './dto/listar-turnos-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('pos')
@RequiereModulo('pos')
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
  listarTurnos(@Query() query: ListarTurnosQueryDto) {
    return this.posService.listar(query);
  }

  @Get('cajeros')
  @Permissions('pos.ver')
  listarCajeros() {
    return this.posService.listarCajeros();
  }

  // Sin @RequiereModulo('nomina') ni permiso nomina.ver a propósito — el
  // vendedor de comisión es un dato del carrito, lo necesita cualquiera
  // con pos.ver (mismo criterio que GET /pos/cajeros).
  @Get('vendedores')
  @Permissions('pos.ver')
  listarVendedores(@Query('busqueda') busqueda?: string) {
    return this.posService.listarVendedores(busqueda);
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
  cerrarTurno(@Param('id') id: string, @Body() dto: CerrarTurnoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.posService.cerrarTurno(id, dto, user.userId, user.tenantId, user.permisos.includes('pos.supervisar'));
  }

  @Post('ventas')
  @Permissions('pos.editar')
  registrarVenta(@Body() dto: RegistrarVentaPosDto, @CurrentUser() user: JwtPayloadUser) {
    return this.posService.registrarVenta(dto, user.tenantId, user.userId);
  }
}
