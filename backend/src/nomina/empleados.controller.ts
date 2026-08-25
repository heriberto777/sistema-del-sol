import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmpleadosService } from './empleados.service';
import { AusenciasService } from './ausencias.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CrearEmpleadoDto } from './dto/crear-empleado.dto';
import { ActualizarEmpleadoDto } from './dto/actualizar-empleado.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListarEmpleadosQueryDto } from './dto/listar-empleados-query.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('nomina')
@RequiereModulo('nomina')
@Controller('nomina/empleados')
export class EmpleadosController {
  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly ausenciasService: AusenciasService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Post()
  @Permissions('nomina.editar')
  crear(@Body() dto: CrearEmpleadoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.empleadosService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('nomina.ver')
  listar(@Query() query: ListarEmpleadosQueryDto) {
    return this.empleadosService.listar(query);
  }

  // Ruta literal declarada antes de ':id' — Nest matchea en orden de
  // declaración (mismo gotcha ya documentado en NcfController para
  // 'modalidad'). Reusa UsuariosService.listar (tenant-scoped, nunca
  // expone passwordHash) en vez de admin.usuarios — un usuario con
  // nomina.editar puede no tener admin.usuarios.
  @Get('usuarios-disponibles')
  @Permissions('nomina.editar')
  usuariosDisponibles(@Query() query: ListadoQueryDto) {
    return this.usuariosService.listar(query);
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

  @Get(':id/balance-vacaciones')
  @Permissions('rrhh.ver')
  async balanceVacaciones(@Param('id') id: string) {
    const empleado = await this.empleadosService.buscarPorId(id);
    return this.ausenciasService.balanceVacaciones(id, empleado.fechaIngreso);
  }
}
