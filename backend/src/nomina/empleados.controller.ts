import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmpleadosService } from './empleados.service';
import { CrearEmpleadoDto } from './dto/crear-empleado.dto';
import { ActualizarEmpleadoDto } from './dto/actualizar-empleado.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('nomina')
@Controller('nomina/empleados')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Post()
  @Permissions('nomina.editar')
  crear(@Body() dto: CrearEmpleadoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.empleadosService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('nomina.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.empleadosService.listar(query);
  }

  @Get(':id')
  @Permissions('nomina.ver')
  buscarPorId(@Param('id') id: string) {
    return this.empleadosService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('nomina.editar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarEmpleadoDto) {
    return this.empleadosService.actualizar(id, dto);
  }
}
