import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfiguracionesService } from './configuraciones.service';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('admin-configuraciones')
@Controller('admin/configuraciones')
export class ConfiguracionesController {
  constructor(private readonly configuracionesService: ConfiguracionesService) {}

  @Get()
  @Permissions('admin.configuracion')
  listar() {
    return this.configuracionesService.listar();
  }

  @Put(':clave')
  @Permissions('admin.configuracion')
  actualizar(
    @Param('clave') clave: string,
    @Body() dto: ActualizarConfiguracionDto,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.configuracionesService.actualizar(clave, dto.valor, user.tenantId);
  }
}
