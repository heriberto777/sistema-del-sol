import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PosService } from './pos.service';
import { AbrirTurnoDto } from './dto/abrir-turno.dto';
import { CerrarTurnoDto } from './dto/cerrar-turno.dto';
import { CrearMovimientoCajaDto } from './dto/crear-movimiento-caja.dto';
import { RegistrarVentaPosDto } from './dto/registrar-venta.dto';
import { CotizarVentaPosDto } from './dto/cotizar-venta.dto';
import { GuardarVentaDto } from './dto/guardar-venta.dto';
import { GuardarBorradorCarritoDto } from './dto/guardar-borrador-carrito.dto';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import { SolicitarAutorizacionDevolucionDto } from './dto/solicitar-autorizacion-devolucion.dto';
import { ListarTurnosQueryDto } from './dto/listar-turnos-query.dto';
import { ReporteCierresQueryDto } from './dto/reporte-cierres-query.dto';
import { PublicarMensajeCajasDto } from './dto/publicar-mensaje-cajas.dto';
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

  // Ruta literal declarada ANTES de 'turnos/:id' — Nest matchea en orden
  // de declaración, así que si ':id' fuera primero, "reporte-cierres" se
  // interpretaría como un id de turno en vez de llegar acá (ítem E-6).
  @Get('turnos/reporte-cierres')
  @Permissions('pos.ver')
  reporteCierres(@Query() query: ReporteCierresQueryDto) {
    return this.posService.reporteCierres(query);
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

  // Ítem E-6 — un turno PENDIENTE_REVISION (diferencia de arqueo fuera de
  // tolerancia) pasa a CERRADO solo cuando un supervisor lo confirma.
  @Patch('turnos/:id/revisar')
  @Permissions('pos.supervisar')
  revisarTurno(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.posService.revisarTurno(id, user.userId);
  }

  // Sin efectos secundarios — el checkout la llama antes de armar los pagos
  // para saber el total real (con ofertas ya resueltas), ver ARCHITECTURE.md.
  @Post('cotizar')
  @Permissions('pos.editar')
  cotizar(@Body() dto: CotizarVentaPosDto) {
    return this.posService.cotizar(dto);
  }

  @Post('ventas')
  @Permissions('pos.editar')
  registrarVenta(@Body() dto: RegistrarVentaPosDto, @CurrentUser() user: JwtPayloadUser) {
    return this.posService.registrarVenta(dto, user.tenantId, user.userId);
  }

  // Ítem D-1 — dispara el envío del código de un solo uso, mismo permiso
  // que registrarDevolucion (quien podría llegar a devolver puede pedirlo).
  @Post('devoluciones/solicitar-autorizacion')
  @Permissions('facturacion.anular')
  solicitarAutorizacionDevolucion(@Body() dto: SolicitarAutorizacionDevolucionDto, @CurrentUser() user: JwtPayloadUser) {
    return this.posService.solicitarAutorizacionDevolucion(dto, user.userId, user.tenantId);
  }

  @Post('devoluciones')
  @Permissions('facturacion.anular')
  registrarDevolucion(@Body() dto: RegistrarDevolucionDto, @CurrentUser() user: JwtPayloadUser) {
    return this.posService.registrarDevolucion(dto, user.tenantId, user.userId);
  }

  // Sin facturacion.ver a propósito — Cajero/Vendedor no lo tienen (ver
  // ARCHITECTURE.md, "Vendedor solo vende por POS"), pero sí necesitan ver
  // el detalle de una venta del turno para armar la Devolución (F4).
  @Get('facturas/:id/devolucion')
  @Permissions('facturacion.anular')
  obtenerFacturaParaDevolucion(@Param('id') id: string) {
    return this.posService.obtenerFacturaParaDevolucion(id);
  }

  @Post('turnos/:id/guardar')
  @Permissions('pos.editar')
  guardarVenta(@Param('id') id: string, @Body() dto: GuardarVentaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.posService.guardarVenta(id, dto, user.tenantId);
  }

  @Get('turnos/:id/guardadas')
  @Permissions('pos.editar')
  listarGuardadas(@Param('id') id: string) {
    return this.posService.listarGuardadas(id);
  }

  @Delete('ventas-aparcadas/:id')
  @Permissions('pos.editar')
  eliminarGuardada(@Param('id') id: string) {
    return this.posService.eliminarGuardada(id);
  }

  // Borrador silencioso del carrito activo — distinto de guardar/guardadas
  // (F12, aparcado explícito). El frontend llama este PUT debounced en cada
  // cambio del carrito (ver TurnoCajaDetalle.tsx).
  @Put('turnos/:id/borrador')
  @Permissions('pos.editar')
  guardarBorrador(@Param('id') id: string, @Body() dto: GuardarBorradorCarritoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.posService.guardarBorrador(id, dto, user.tenantId);
  }

  @Get('turnos/:id/borrador')
  @Permissions('pos.editar')
  obtenerBorrador(@Param('id') id: string) {
    return this.posService.obtenerBorrador(id);
  }

  @Delete('turnos/:id/borrador')
  @Permissions('pos.editar')
  eliminarBorrador(@Param('id') id: string) {
    return this.posService.eliminarBorrador(id);
  }

  // "Mensaje a cajas" (ítem J-3) — GET sin permiso más restrictivo que
  // pos.ver a propósito: cualquier cajero con un turno abierto necesita
  // poder verlo, no solo quien lo publica.
  @Get('mensaje-cajas')
  @Permissions('pos.ver')
  obtenerMensajeCajas(@CurrentUser() user: JwtPayloadUser) {
    return this.posService.obtenerMensajeCajas(user.tenantId);
  }

  @Post('mensaje-cajas')
  @Permissions('pos.supervisar')
  publicarMensajeCajas(@Body() dto: PublicarMensajeCajasDto, @CurrentUser() user: JwtPayloadUser) {
    return this.posService.publicarMensajeCajas(user.tenantId, dto.texto);
  }

  @Delete('mensaje-cajas')
  @Permissions('pos.supervisar')
  borrarMensajeCajas(@CurrentUser() user: JwtPayloadUser) {
    return this.posService.borrarMensajeCajas(user.tenantId);
  }
}
