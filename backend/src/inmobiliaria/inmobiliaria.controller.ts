import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InmobiliariaService, ListadoPropiedadesQueryDto } from './inmobiliaria.service';
import { CrearPropiedadDto } from './dto/crear-propiedad.dto';
import { CrearContratoPropiedadDto } from './dto/crear-contrato-propiedad.dto';
import { CrearPreventaDto } from './dto/crear-preventa.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('inmobiliaria')
@RequiereModulo('inmobiliaria')
@Controller('admin/inmobiliaria/propiedades')
export class InmobiliariaController {
  constructor(private readonly inmobiliariaService: InmobiliariaService) {}

  @Post()
  @Permissions('inmobiliaria.propiedades.crear')
  crear(@Body() dto: CrearPropiedadDto, @CurrentUser() user: JwtPayloadUser) {
    return this.inmobiliariaService.crear(dto, user.tenantId);
  }

  // Ruta literal antes de ':id' a propósito (mismo cuidado de orden que ProyectosController).
  @Get('agentes')
  @Permissions('inmobiliaria.propiedades.ver')
  listarAgentesDisponibles() {
    return this.inmobiliariaService.listarAgentesDisponibles();
  }

  @Get()
  @Permissions('inmobiliaria.propiedades.ver')
  listar(@Query() query: ListadoPropiedadesQueryDto) {
    return this.inmobiliariaService.listar(query);
  }

  @Get(':id')
  @Permissions('inmobiliaria.propiedades.ver')
  buscarPorId(@Param('id') id: string) {
    return this.inmobiliariaService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('inmobiliaria.propiedades.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearPropiedadDto>) {
    return this.inmobiliariaService.actualizar(id, dto);
  }

  @Delete(':id')
  @Permissions('inmobiliaria.propiedades.eliminar')
  eliminar(@Param('id') id: string) {
    return this.inmobiliariaService.eliminar(id);
  }

  // Fase 3 — permiso separado de `.propiedades.*` a propósito (ver roles-base.ts):
  // cerrar un negocio es una acción fiscal/comercial, no una edición más del listado.
  @Post(':id/contratos')
  @Permissions('inmobiliaria.contratos.crear')
  crearContrato(@Param('id') propiedadId: string, @Body() dto: CrearContratoPropiedadDto, @CurrentUser() user: JwtPayloadUser) {
    return this.inmobiliariaService.crearContrato(propiedadId, dto, user.tenantId);
  }

  // Modelo 3 — inicia/desvincula el Proyecto de preventa (plugin Proyectos)
  // de esta propiedad; ver/cargar los hitos del plan de pagos en sí se
  // hace desde /proyectos/:id, sin duplicar esa pantalla acá.
  @Post(':id/preventa')
  @Permissions('inmobiliaria.preventas.crear')
  crearPreventa(@Param('id') propiedadId: string, @Body() dto: CrearPreventaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.inmobiliariaService.crearPreventa(propiedadId, dto, user.tenantId);
  }

  @Delete(':id/preventa')
  @Permissions('inmobiliaria.preventas.crear')
  desvincularPreventa(@Param('id') propiedadId: string) {
    return this.inmobiliariaService.desvincularPreventa(propiedadId);
  }
}
