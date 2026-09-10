import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InmobiliariaService } from './inmobiliaria.service';
import { ListadoContratosQueryDto } from './dto/listado-contratos-query.dto';
import { ActivarAdministracionAlquilerDto } from './dto/activar-administracion-alquiler.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';

/**
 * Contratos de propiedad (Fase 3) — separado de `InmobiliariaController`
 * porque no cuelga de una propiedad puntual (a diferencia de "crear", que
 * sí vive bajo `propiedades/:id/contratos`): esta es la pantalla de
 * "Comisiones", que cruza contratos de TODAS las propiedades.
 */
@ApiBearerAuth()
@ApiTags('inmobiliaria')
@RequiereModulo('inmobiliaria')
@Controller('admin/inmobiliaria/contratos')
export class InmobiliariaContratosController {
  constructor(private readonly inmobiliariaService: InmobiliariaService) {}

  @Get()
  @Permissions('inmobiliaria.contratos.ver')
  listar(@Query() query: ListadoContratosQueryDto) {
    return this.inmobiliariaService.listarContratos(query);
  }

  @Get(':id')
  @Permissions('inmobiliaria.contratos.ver')
  buscarPorId(@Param('id') id: string) {
    return this.inmobiliariaService.buscarContratoPorId(id);
  }

  @Patch(':id/anular')
  @Permissions('inmobiliaria.contratos.anular')
  anular(@Param('id') id: string) {
    return this.inmobiliariaService.anularContrato(id);
  }

  // Reusa el permiso de "crear" (no ".ver", de solo lectura) — marcar la
  // comisión como pagada cambia estado financiero real.
  @Patch(':id/comision-pagada')
  @Permissions('inmobiliaria.contratos.crear')
  marcarComisionPagada(@Param('id') id: string) {
    return this.inmobiliariaService.marcarComisionPagada(id);
  }

  // Modelo 2 — activar/pausar la administración recurrente de un alquiler
  // ya cerrado. Permiso propio de alquileres, no de contratos: es un
  // servicio adicional que se le vende al propietario, no una edición del
  // contrato en sí.
  @Patch(':id/administracion-alquiler')
  @Permissions('inmobiliaria.alquileres.gestionar')
  activarAdministracionAlquiler(@Param('id') id: string, @Body() dto: ActivarAdministracionAlquilerDto) {
    return this.inmobiliariaService.activarAdministracionAlquiler(id, dto);
  }

  @Delete(':id/administracion-alquiler')
  @Permissions('inmobiliaria.alquileres.gestionar')
  desactivarAdministracionAlquiler(@Param('id') id: string) {
    return this.inmobiliariaService.desactivarAdministracionAlquiler(id);
  }
}
