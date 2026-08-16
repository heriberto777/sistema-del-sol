import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TipoNcf } from '@prisma/client';
import { NcfService } from './ncf.service';
import { CrearNcfDto } from './dto/crear-ncf.dto';
import { ActualizarNcfDto } from './dto/actualizar-ncf.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('admin-ncf')
@Controller('admin/ncf')
export class NcfController {
  constructor(private readonly ncfService: NcfService) {}

  @Get()
  @Permissions('admin.configuracion')
  listar() {
    return this.ncfService.listar();
  }

  @Post()
  @Permissions('admin.configuracion')
  crear(@Body() dto: CrearNcfDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ncfService.crear(dto, user.tenantId);
  }

  @Patch(':tipoNcf')
  @Permissions('admin.configuracion')
  actualizar(@Param('tipoNcf') tipoNcf: TipoNcf, @Body() dto: ActualizarNcfDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ncfService.actualizar(tipoNcf, dto, user.tenantId);
  }
}
