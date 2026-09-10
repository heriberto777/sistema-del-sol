import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InmobiliariaService } from './inmobiliaria.service';
import { ListadoCobrosAlquilerQueryDto } from './dto/listado-cobros-alquiler-query.dto';
import { MarcarCobradoAlquilerDto } from './dto/marcar-cobrado-alquiler.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/**
 * Modelo 2 (administradora de alquileres) — pantalla "Cobros de alquiler",
 * cruza cobros generados por `CobrosAlquilerCronService` de TODOS los
 * contratos bajo administración (por eso vive separado de
 * `InmobiliariaContratosController`, mismo criterio que Contratos vive
 * separado de Propiedades).
 */
@ApiBearerAuth()
@ApiTags('inmobiliaria')
@RequiereModulo('inmobiliaria')
@Controller('admin/inmobiliaria/alquileres')
export class InmobiliariaAlquileresController {
  constructor(private readonly inmobiliariaService: InmobiliariaService) {}

  @Get()
  @Permissions('inmobiliaria.alquileres.ver')
  listar(@Query() query: ListadoCobrosAlquilerQueryDto) {
    return this.inmobiliariaService.listarCobrosAlquiler(query);
  }

  @Get(':id')
  @Permissions('inmobiliaria.alquileres.ver')
  buscarPorId(@Param('id') id: string) {
    return this.inmobiliariaService.buscarCobroAlquilerPorId(id);
  }

  @Patch(':id/cobrado')
  @Permissions('inmobiliaria.alquileres.gestionar')
  marcarCobrado(@Param('id') id: string, @Body() dto: MarcarCobradoAlquilerDto, @CurrentUser() user: JwtPayloadUser) {
    return this.inmobiliariaService.marcarCobradoAlquiler(id, dto, user.tenantId, user.userId);
  }

  @Patch(':id/liquidar')
  @Permissions('inmobiliaria.alquileres.gestionar')
  liquidar(@Param('id') id: string) {
    return this.inmobiliariaService.liquidarPropietarioAlquiler(id);
  }
}
