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

  @Post()
  @Permissions('contabilidad.editar')
  cerrarPeriodo(@Body() dto: CerrarPeriodoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.cierrePeriodoService.cerrarPeriodo(dto, user.tenantId);
  }
}
