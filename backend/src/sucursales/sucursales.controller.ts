import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SucursalesService } from './sucursales.service';
import { CrearSucursalDto } from './dto/crear-sucursal.dto';
import { ActualizarSucursalDto } from './dto/actualizar-sucursal.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

// Sin @RequiereModulo: Sucursales no es un módulo gateable por plan, es
// plomería de ubicación compartida (mismo criterio que Contabilidad/
// Contactos/Reportes — ver docs/ARCHITECTURE.md).
@ApiBearerAuth()
@ApiTags('sucursales')
@Controller('sucursales')
export class SucursalesController {
  constructor(private readonly sucursalesService: SucursalesService) {}

  @Post()
  @Permissions('sucursales.editar')
  crear(@Body() dto: CrearSucursalDto, @CurrentUser() user: JwtPayloadUser) {
    return this.sucursalesService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('sucursales.ver')
  listar() {
    return this.sucursalesService.listar();
  }

  // Sin @Permissions — autoservicio: cualquier usuario logueado puede
  // saber en qué sucursales puede elegir trabajar (mismo criterio que
  // AsistenciaController.miEstadoHoy en RRHH).
  @Get('mias')
  mias(@CurrentUser() user: JwtPayloadUser) {
    return this.sucursalesService.mias(user.userId);
  }

  @Get(':id')
  @Permissions('sucursales.ver')
  buscarPorId(@Param('id') id: string) {
    return this.sucursalesService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('sucursales.editar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarSucursalDto) {
    return this.sucursalesService.actualizar(id, dto);
  }
}
