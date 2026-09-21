import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProyectosService } from './proyectos.service';
import { ProyectosIaService } from './proyectos-ia.service';
import { CrearProyectoDto } from './dto/crear-proyecto.dto';
import { CrearHitoDto } from './dto/crear-hito.dto';
import { FacturarConsolidadoDto } from './dto/facturar-consolidado.dto';
import { GenerarTareasIaDto } from './dto/generar-tareas-ia.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('proyectos')
@RequiereModulo('proyectos')
@Controller('admin/proyectos')
export class ProyectosController {
  constructor(
    private readonly proyectosService: ProyectosService,
    private readonly proyectosIaService: ProyectosIaService,
  ) {}

  @Post()
  @Permissions('proyectos.crear')
  crear(@Body() dto: CrearProyectoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.proyectosService.crear(dto, user.tenantId);
  }

  // Fase 7 — sin `:id` a propósito: sirve tanto para un proyecto ya creado
  // como para el modal de "Nuevo proyecto" (todavía sin id). Permiso opt-in
  // separado de `proyectos.crear` (ver roles-base.ts).
  @Post('generar-tareas-ia')
  @Permissions('proyectos.ia_generar')
  generarTareasConIa(@Body() dto: GenerarTareasIaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.proyectosIaService.generarTareas(user.tenantId, dto.nombreProyecto, dto.descripcion);
  }

  @Get()
  @Permissions('proyectos.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.proyectosService.listar(query);
  }

  // Ruta literal antes de ':id' a propósito (mismo cuidado de orden que
  // otros controllers de este proyecto, ej. FacturacionController).
  @Get('empleados')
  @Permissions('proyectos.ver')
  listarEmpleadosDisponibles() {
    return this.proyectosService.listarEmpleadosDisponibles();
  }

  // Fase 6 (cronómetro) — ruta literal antes de ':id' por el mismo motivo que 'empleados'.
  @Get('mi-empleado')
  @Permissions('proyectos.ver')
  async miEmpleado(@CurrentUser() user: JwtPayloadUser) {
    return { empleadoId: await this.proyectosService.miEmpleadoId(user.userId) };
  }

  // Dashboard "Resumen ejecutivo" — rutas literales antes de ':id', mismo motivo que 'empleados'/'mi-empleado'.
  @Get('resumen-rentabilidad')
  @Permissions('proyectos.rentabilidad.ver')
  resumenRentabilidad(@CurrentUser() user: JwtPayloadUser) {
    return this.proyectosService.resumenRentabilidad(user.tenantId);
  }

  @Get('resumen-alertas')
  @Permissions('proyectos.ver')
  resumenAlertas() {
    return this.proyectosService.resumenAlertas();
  }

  @Get(':id')
  @Permissions('proyectos.ver')
  buscarPorId(@Param('id') id: string) {
    return this.proyectosService.buscarPorId(id);
  }

  // Permiso propio, separado de `proyectos.ver` a propósito — expone costo
  // interno derivado del salario de los empleados (ver roles-base.ts).
  @Get(':id/rentabilidad')
  @Permissions('proyectos.rentabilidad.ver')
  calcularRentabilidad(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.proyectosService.calcularRentabilidad(id, user.tenantId);
  }

  // Fase 5 — mismo permiso que `rentabilidad` (deriva del salario de los
  // empleados): costo interno de horas ya cargadas, por Hito, para avisar
  // en la UI si el `montoFijo` pactado no lo cubre.
  @Get(':id/costo-horas-hitos')
  @Permissions('proyectos.rentabilidad.ver')
  calcularCostoHorasHitos(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.proyectosService.calcularCostoHorasPorHito(id, user.tenantId);
  }

  @Patch(':id')
  @Permissions('proyectos.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearProyectoDto>) {
    return this.proyectosService.actualizar(id, dto);
  }

  @Delete(':id')
  @Permissions('proyectos.editar')
  eliminar(@Param('id') id: string) {
    return this.proyectosService.eliminar(id);
  }

  // ---------- Hitos ----------

  @Post(':proyectoId/hitos')
  @Permissions('proyectos.crear')
  crearHito(@Param('proyectoId') proyectoId: string, @Body() dto: CrearHitoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.proyectosService.crearHito(proyectoId, dto, user.tenantId);
  }

  @Patch('hitos/:id')
  @Permissions('proyectos.editar')
  actualizarHito(@Param('id') id: string, @Body() dto: Partial<CrearHitoDto>) {
    return this.proyectosService.actualizarHito(id, dto);
  }

  @Delete('hitos/:id')
  @Permissions('proyectos.editar')
  eliminarHito(@Param('id') id: string) {
    return this.proyectosService.eliminarHito(id);
  }

  // Fase 4 — permiso separado de `.editar`: generar una Factura real es
  // una acción fiscal, no una edición más del hito (ver roles-base.ts).
  @Post('hitos/:id/facturar')
  @Permissions('proyectos.facturar')
  facturarHito(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.proyectosService.facturarHito(id, user.tenantId, user.userId);
  }

  // Datos para el modal de confirmación previo a facturar (mismo permiso — es
  // parte del mismo flujo fiscal, no una consulta de solo-lectura cualquiera).
  @Get('hitos/:id/previsualizar-factura')
  @Permissions('proyectos.facturar')
  previsualizarFacturaHito(@Param('id') id: string) {
    return this.proyectosService.previsualizarFacturaHito(id);
  }

  // "Facturar todo" — una sola Factura para varios hitos sin facturar del proyecto, mismo permiso fiscal que facturar uno solo.
  @Get(':proyectoId/hitos/previsualizar-factura-consolidada')
  @Permissions('proyectos.facturar')
  previsualizarFacturaConsolidada(@Param('proyectoId') proyectoId: string) {
    return this.proyectosService.previsualizarFacturaConsolidada(proyectoId);
  }

  @Post(':proyectoId/hitos/facturar-consolidado')
  @Permissions('proyectos.facturar')
  facturarConsolidado(@Param('proyectoId') proyectoId: string, @Body() dto: FacturarConsolidadoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.proyectosService.facturarConsolidado(proyectoId, dto.hitoIds, user.tenantId, user.userId);
  }
}
