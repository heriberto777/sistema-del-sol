import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CuentasContablesService } from './cuentas-contables.service';
import { CrearCuentaContableDto } from './dto/crear-cuenta-contable.dto';
import { ConfigurarCuentaSistemaDto } from './dto/configurar-cuenta-sistema.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('contabilidad')
@Controller('contabilidad/cuentas')
export class CuentasContablesController {
  constructor(private readonly cuentasContablesService: CuentasContablesService) {}

  @Get()
  @Permissions('contabilidad.ver')
  listar() {
    return this.cuentasContablesService.listar();
  }

  @Post()
  @Permissions('contabilidad.editar')
  crear(@Body() dto: CrearCuentaContableDto, @CurrentUser() user: JwtPayloadUser) {
    return this.cuentasContablesService.crear(dto, user.tenantId);
  }

  @Post('completar-catalogo')
  @Permissions('contabilidad.editar')
  completarCatalogo(@CurrentUser() user: JwtPayloadUser) {
    return this.cuentasContablesService.completarCatalogo(user.tenantId);
  }

  // docs/PLAN.md, punto 4 — override por tenant de los 15 códigos fijos
  // que el motor de asientos automáticos resuelve por rol.
  @Get('configuracion-sistema')
  @Permissions('contabilidad.ver')
  listarConfiguracionSistema(@CurrentUser() user: JwtPayloadUser) {
    return this.cuentasContablesService.listarConfiguracionCuentasSistema(user.tenantId);
  }

  @Post('configuracion-sistema')
  @Permissions('contabilidad.editar')
  configurarCuentaSistema(@Body() dto: ConfigurarCuentaSistemaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.cuentasContablesService.configurarCuentaSistema(dto.clave, dto.cuentaContableId, user.tenantId);
  }

  @Delete('configuracion-sistema/:clave')
  @Permissions('contabilidad.editar')
  quitarConfiguracionSistema(@Param('clave') clave: string, @CurrentUser() user: JwtPayloadUser) {
    return this.cuentasContablesService.quitarConfiguracionCuentaSistema(clave, user.tenantId);
  }
}
