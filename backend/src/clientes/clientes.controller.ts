import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('clientes')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Permissions('clientes.crear')
  crear(@Body() dto: CrearClienteDto, @CurrentUser() user: JwtPayloadUser) {
    return this.clientesService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('clientes.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.clientesService.listar(query);
  }

  @Get(':id')
  @Permissions('clientes.ver')
  buscarPorId(@Param('id') id: string) {
    return this.clientesService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('clientes.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearClienteDto>) {
    return this.clientesService.actualizar(id, dto);
  }
}
