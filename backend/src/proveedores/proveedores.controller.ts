import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProveedoresService } from './proveedores.service';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('proveedores')
@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Post()
  @Permissions('compras.crear')
  crear(@Body() dto: CrearProveedorDto, @CurrentUser() user: JwtPayloadUser) {
    return this.proveedoresService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('compras.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.proveedoresService.listar(query);
  }

  @Get(':id')
  @Permissions('compras.ver')
  buscarPorId(@Param('id') id: string) {
    return this.proveedoresService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('compras.crear')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearProveedorDto>) {
    return this.proveedoresService.actualizar(id, dto);
  }
}
