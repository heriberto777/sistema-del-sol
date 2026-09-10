import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InmobiliariaPublicaService } from './inmobiliaria-publica.service';
import { ListadoPropiedadesPublicoQueryDto } from './dto/listado-propiedades-publico-query.dto';
import { CrearAlertaBusquedaDto } from './dto/crear-alerta-busqueda.dto';
import { Public } from '../common/decorators/public.decorator';

/**
 * Catálogo público del plugin Inmobiliaria — sin JWT, resuelto por
 * `:subdominio` explícito en la URL, mismo criterio que
 * `EcommerceController` (storefront de Tienda Online).
 */
@ApiTags('inmobiliaria-publica')
@Public()
@Controller('inmobiliaria/:subdominio')
export class InmobiliariaPublicaController {
  constructor(private readonly inmobiliariaPublicaService: InmobiliariaPublicaService) {}

  @Get('config')
  config(@Param('subdominio') subdominio: string) {
    return this.inmobiliariaPublicaService.config(subdominio);
  }

  @Get('propiedades')
  listar(@Param('subdominio') subdominio: string, @Query() query: ListadoPropiedadesPublicoQueryDto) {
    return this.inmobiliariaPublicaService.listar(subdominio, query);
  }

  @Get('propiedades/:id')
  buscarPorId(@Param('subdominio') subdominio: string, @Param('id') id: string) {
    return this.inmobiliariaPublicaService.buscarPorId(subdominio, id);
  }

  @Post('alertas')
  crearAlerta(@Param('subdominio') subdominio: string, @Body() dto: CrearAlertaBusquedaDto) {
    return this.inmobiliariaPublicaService.crearAlerta(subdominio, dto);
  }
}
