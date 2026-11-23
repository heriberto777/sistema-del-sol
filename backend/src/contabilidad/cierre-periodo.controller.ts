import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CierrePeriodoService } from './cierre-periodo.service';
import { CerrarPeriodoDto } from './dto/cerrar-periodo.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('contabilidad')
@Controller('contabilidad/cierre-periodo')
export class CierrePeriodoController {
  constructor(private readonly cierrePeriodoService: CierrePeriodoService) {}

  @Get()
  @Permissions('contabilidad.ver')
  listar() {
    return this.cierrePeriodoService.listar();
  }

  // Sin @Permissions a propósito — lo consultan pantallas de otros
  // módulos (Facturación/Compras/Nómina/Gastos Menores) para avisar si
  // hoy no cae dentro de ningún período, y un usuario de esos módulos no
  // necesariamente tiene `contabilidad.ver`. Sigue requiriendo estar
  // autenticado (JwtAuthGuard global) — no expone montos, solo si existe
  // un período que cubra la fecha de hoy.
  @Get('vigente')
  vigente() {
    return this.cierrePeriodoService.obtenerVigente();
  }

  // Mismo permiso que cerrar — "crear período" y "cerrar período" son la
  // misma capacidad de gestión de períodos para el rol Contador/Admin
  // Total, reusarlo evita sumar un permiso nuevo que necesitaría
  // backfill en producción.
  @Post('completar-faltantes')
  @Permissions('contabilidad.cerrarperiodo')
  completarFaltantes(@CurrentUser() user: JwtPayloadUser) {
    return this.cierrePeriodoService.completarFaltantes(user.tenantId);
  }

  @Post()
  // Corrección: el permiso real para esta acción era 'contabilidad.editar'
  // pese a que 'contabilidad.cerrarperiodo' ya existía en PERMISOS_BASE y
  // gatea este mismo ítem de menú en el frontend (ModuloPestanas) — quedó
  // huérfano, nunca conectado a ningún endpoint. Ahora coinciden.
  @Permissions('contabilidad.cerrarperiodo')
  cerrarPeriodo(@Body() dto: CerrarPeriodoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.cierrePeriodoService.cerrarPeriodo(dto, user.tenantId);
  }
}
