import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CuentasContablesService } from './cuentas-contables.service';
import { CrearCuentaContableDto } from './dto/crear-cuenta-contable.dto';
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
}
